#!/usr/bin/env node
// Espelho do WhatsApp na tela do Empresa OS (21/11/2026).
// Para quem JA conectou o WhatsApp pelo Codex ("Conecta meu WhatsApp."): o mesmo número passa a
// aparecer na tela, sem QR Code. O motor continua dono da conexão (@ia, rotinas, grupos, início automático).
// Uso (na pasta da Casa ou em qualquer subpasta dela):  node instalar-espelho.mjs   |   --desfazer
// Imprime só linhas CHAVE=valor. Nunca imprime chave, token, URL do banco ou número completo.
// Se qualquer prova falhar, desfaz sozinho e confere que o WhatsApp voltou como estava.
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {copyFile,mkdir,readFile,rm,writeFile,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const VERSAO='espelho-2026-11-21';
const FONTE=process.env.ESPELHO_FONTE||"https://raw.githubusercontent.com/polozigit/whatsapp-espelho/main";
// Arquivos trocados: hash da versão que o aluno recebeu (kit de 19/11) e da versão com espelho.
const ARQUIVOS=[
 {
  "caminho": "src/engine.mjs",
  "fonte": "arquivos/src__engine.mjs",
  "antes": "73809e9794c11725c26c9c6af088fc762b6531f2337fbeba0cd132a7924c0ff7",
  "depois": "cbf6b469279956ce3d80760be7e3562bae45ddef5bf56af16917035213fdf9c4"
 },
 {
  "caminho": "src/multicanal/baileys-adapter.mjs",
  "fonte": "arquivos/src__multicanal__baileys-adapter.mjs",
  "antes": "55644ba7fc2d1ba8d737c281d1aba7638dd496239803fa1053312da5ab8914cc",
  "depois": "1b79482190ab53f43d6df1076e9d261c94ccf9e95aee04c3ad36299a1a23fa9d"
 },
 {
  "caminho": "src/multicanal/espelho.mjs",
  "fonte": "arquivos/src__multicanal__espelho.mjs",
  "antes": null,
  "depois": "7bf8fffa3d774924a9a2e3fd354012212a456a133b8313df2de1988f2bfd8175"
 }
];
const run=promisify(execFile);
const out=(k,v)=>console.log(`${k}=${v}`);
const sha=buf=>createHash('sha256').update(buf).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function acharPastaWhatsapp(inicio=process.cwd()){
  let dir=path.resolve(inicio);
  for(let i=0;i<8;i++){
    for(const c of [path.join(dir,'sistemas','whatsapp'),dir])
      if(existsSync(path.join(c,'src','engine.mjs'))&&existsSync(path.join(c,'src','multicanal','cli.mjs')))return c;
    const up=path.dirname(dir);if(up===dir)break;dir=up;
  }
  return null;
}
function lerEnv(texto){
  const env={};
  for(const linha of texto.split(/\r?\n/)){const m=linha.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}
  return env;
}
async function node(W,args,env,timeout=180000){
  try{const r=await run(process.execPath,args,{cwd:W,env,timeout,windowsHide:true,maxBuffer:4e6});return {ok:true,saida:r.stdout+r.stderr};}
  catch(e){return {ok:false,saida:String(e.stdout||'')+String(e.stderr||'')+String(e.message||'')};}
}
const linha=(saida,chave)=>(saida.match(new RegExp(`^${chave}=(.*)$`,'m'))||[])[1]||'';

async function pararConectorSolto(W,env){
  // O conector separado da tela (mensageria:iniciar) não pode disputar a mesma conta com o espelho.
  await node(W,[path.join('src','multicanal','cli.mjs'),'parar'],env,60000);
  if(process.platform==='win32'){
    await run('powershell.exe',['-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'multicanal.cli\\.mjs.*iniciar' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],{windowsHide:true,timeout:60000}).catch(()=>{});
  }else await run('pkill',['-f','multicanal/cli.mjs iniciar']).catch(()=>{});
}
async function reiniciarMotor(W,env){
  await node(W,[path.join('src','stop.mjs')],env,60000);
  await sleep(1500);
  const r=await node(W,[path.join('src','start-background.mjs')],env,120000);
  const ia=linha(r.saida,'WHATSAPP_LIVE_ASSISTANT').split(' ')[0];
  const conectado=!/WHATSAPP_CONNECTION=NOT_CONNECTED/.test(r.saida)&&/WHATSAPP_MOTOR=NO_AR/.test(r.saida);
  return {conectado,ia:['INICIADO','JA_RODANDO'].includes(ia),iaTexto:ia||'sem_resposta'};
}
async function logDesde(W,inicio){
  const {getEngineLogFile}=await import(pathToFileURL(path.join(W,'src','local-paths.mjs')).href);
  const texto=await readFile(getEngineLogFile(),'utf8').catch(()=>'');
  return texto.split(/\r?\n/).filter(l=>{const t=Date.parse(l.slice(0,24));return Number.isFinite(t)&&t>=inicio-2000;}).join('\n');
}
async function estadoNaTela(W){
  const {getStateDirectory}=await import(pathToFileURL(path.join(W,'src','local-paths.mjs')).href);
  const {createDeviceClient}=await import(pathToFileURL(path.join(W,'src','multicanal','device-client.mjs')).href);
  const cfg=JSON.parse(await readFile(process.env.MENSAGERIA_CONFIG||path.join(getStateDirectory(),'multicanal','conexao.json'),'utf8'));
  const {contas=[]}=await createDeviceClient(cfg).call('contas');
  return contas.filter(c=>c.provedor==='baileys').map(c=>c.estado);
}

async function restaurar(W,backup,env,motivo){
  out('ESPELHO_FALHOU',motivo);
  for(const a of ARQUIVOS){
    const destino=path.join(W,a.caminho),copia=path.join(backup,a.caminho.replace(/[\\/]/g,'__'));
    if(existsSync(copia))await copyFile(copia,destino);else if(!a.antes)await rm(destino,{force:true});
  }
  const m=await reiniciarMotor(W,env);
  out('ROLLBACK',m.conectado?'OK':'FEITO_MAS_MOTOR_DESCONECTADO');
  out('WHATSAPP_CONECTADO',m.conectado?'sim':'nao');
  out('IA_NO_WHATSAPP',m.ia?'sim':m.iaTexto);
  if(!m.conectado)out('PROXIMO_PASSO','peça ao Codex: "reconecta meu WhatsApp" (npm run conectar)');
  process.exitCode=1;
}

async function main(){
  out('ESPELHO_VERSAO',VERSAO);
  const W=acharPastaWhatsapp();
  if(!W){out('ESPELHO_ERRO','pasta sistemas/whatsapp não encontrada; rode dentro da pasta da Casa');process.exitCode=2;return;}
  const casa=path.resolve(W,'..','..');
  const envCasa=existsSync(path.join(casa,'credenciais','.env'))?lerEnv(await readFile(path.join(casa,'credenciais','.env'),'utf8')):{};
  const env={...process.env,...envCasa};
  const {getStateDirectory}=await import(pathToFileURL(path.join(W,'src','local-paths.mjs')).href);
  const backup=path.join(getStateDirectory(),'espelho-backup');

  if(process.argv.includes('--desfazer')){
    if(!existsSync(backup)){out('ESPELHO_ERRO','não há backup do espelho neste computador');process.exitCode=2;return;}
    await restaurar(W,backup,env,'pedido_desfazer');return;
  }

  // 1. Versão: só mexe se os arquivos forem exatamente os do kit ou já os do espelho.
  const atuais=[];
  for(const a of ARQUIVOS){
    const f=path.join(W,a.caminho);const h=existsSync(f)?sha(await readFile(f)):null;
    if(h!==a.antes&&h!==a.depois){out('ESPELHO_ERRO',`versão do WhatsApp diferente da esperada (${a.caminho}); nada foi alterado`);process.exitCode=2;return;}
    atuais.push(h);
  }
  const jaInstalado=ARQUIVOS.every((a,i)=>atuais[i]===a.depois);

  // 2. Pré-requisito: WhatsApp do motor conectado.
  const st=await node(W,[path.join('src','status.mjs')],env,60000);
  // ESPELHO_TESTE_SANDBOX: só para o teste do rollback em pasta descartável (nunca no aluno).
  if(linha(st.saida,'WHATSAPP_CONNECTION')!=='CONNECTED'&&process.env.ESPELHO_TESTE_SANDBOX!=='1'){out('ESPELHO_ERRO','WhatsApp do Codex desconectado; conecte primeiro (npm run conectar). Nada foi alterado');process.exitCode=2;return;}
  if(!env.SUPABASE_SERVICE_ROLE_KEY||!(env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL)){out('ESPELHO_ERRO','credenciais/.env da Casa sem as chaves do Supabase; nada foi alterado');process.exitCode=2;return;}

  // 3. Backup fora da Casa (uma vez: guarda sempre a versão original do kit).
  if(!jaInstalado){
    await mkdir(backup,{recursive:true,mode:0o700});
    for(const a of ARQUIVOS){const f=path.join(W,a.caminho),copia=path.join(backup,a.caminho.replace(/[\\/]/g,'__'));if(existsSync(f)&&!existsSync(copia))await copyFile(f,copia);}
    out('BACKUP','ok');
  }
  const inicio=Date.now();
  try{
    // 4. Baixa e confere cada arquivo pelo hash antes de gravar.
    if(!jaInstalado){
      const novos=[];
      for(const a of ARQUIVOS){
        const r=await fetch(`${FONTE}/${a.fonte}`,{signal:AbortSignal.timeout(60000)});
        if(!r.ok)throw new Error(`download_${r.status}`);
        const buf=Buffer.from(await r.arrayBuffer());if(sha(buf)!==a.depois)throw new Error(`hash_diferente_${path.basename(a.caminho)}`);
        novos.push([a,buf]);
      }
      for(const [a,buf] of novos)await writeFile(path.join(W,a.caminho),buf);
      out('ARQUIVOS','gravados');
    }else out('ARQUIVOS','ja_instalados');
    // 5. Liga o computador à tela (mesma ação da instalação da Casa) e para o conector separado.
    const lig=await node(W,[path.join('src','multicanal','cli.mjs'),'ligar'],env,120000);
    if(!lig.ok)throw new Error('ligar_computador: '+lig.saida.split('\n').filter(Boolean).pop()?.slice(0,160));
    out('COMPUTADOR_NA_TELA','ligado');
    await pararConectorSolto(W,env);
    // 6. Reinicia o motor com o espelho e prova.
    const m=await reiniciarMotor(W,env);
    if(!m.conectado)throw new Error('motor_nao_reconectou');
    if(!m.ia)throw new Error('ia_no_whatsapp_nao_voltou_'+m.iaTexto);
    let log='',estados=[];
    for(let i=0;i<40;i++){
      await sleep(3000);
      log=await logDesde(W,inicio);
      if(/ESPELHO_AGUARDANDO=nenhuma conta/.test(log))break;
      estados=await estadoNaTela(W).catch(()=>[]);
      if(estados.includes('conectada'))break;
    }
    if(!/ESPELHO=LIGADO/.test(log))throw new Error('espelho_nao_ligou');
    out('WHATSAPP_CONECTADO','sim');out('IA_NO_WHATSAPP','sim');
    if(/ESPELHO_AGUARDANDO=nenhuma conta/.test(log)){
      out('NA_TELA','falta_adicionar_numero');
      out('PROXIMO_PASSO','na tela do Empresa OS, WhatsApp > Adicionar número (QR Code) com este mesmo número; NÃO leia QR; depois rode este comando de novo');
      return;
    }
    if(/ESPELHO_AGUARDANDO=mais de uma/.test(log)){
      out('NA_TELA','duas_contas_qr');
      out('PROXIMO_PASSO','na tela, deixe só uma conta de QR Code, com o número deste WhatsApp, e rode de novo');
      return;
    }
    if(!estados.includes('conectada'))throw new Error('tela_nao_mostrou_conectada_'+(estados.join('|')||'sem_conta'));
    out('NA_TELA','conectada');
    out('ESPELHO','OK');
    out('PROXIMO_PASSO','abra a tela WhatsApp do Empresa OS: mensagens novas aparecem a partir de agora (as antigas não)');
  }catch(error){
    await restaurar(W,backup,env,String(error?.message||error).replace(/https?:\/\/\S+/g,'[url]').slice(0,200));
  }
}
main().catch(error=>{out('ESPELHO_ERRO',String(error?.message||error).slice(0,200));process.exitCode=1;});
