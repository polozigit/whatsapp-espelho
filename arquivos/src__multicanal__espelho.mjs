// Espelho da tela (21/11/2026): o motor do WhatsApp continua dono da conexão (@ia, rotinas do Codex,
// grupos, início automático) e, quando o computador está ligado ao Empresa OS (`mensageria:ligar`),
// também alimenta a caixa de mensagens da tela e executa o que a tela pedir, PELA MESMA conexão.
// Nada aqui cria, copia ou apaga a sessão do WhatsApp: ela segue só na pasta do motor.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {getStateDirectory} from '../local-paths.mjs';
import {createDeviceClient} from './device-client.mjs';
import {DurableSpool} from './spool.mjs';
import {MultiAccountRuntime} from './runtime.mjs';
import {RawInbox} from './raw-inbox.mjs';
import {createBaileysAdapter} from './baileys-adapter.mjs';

export const ESPELHO_CONFIG=()=>process.env.MENSAGERIA_CONFIG||path.join(getStateDirectory(),'multicanal','conexao.json');

const digits=value=>String(value||'').replace(/\D/g,'');
// Mesmo número com ou sem o nono dígito: compara os 8 últimos dígitos e o DDD.
export function mesmoNumero(a,b){
  const x=digits(a),y=digits(b);if(x.length<10||y.length<10)return false;
  return x.slice(-8)===y.slice(-8)&&x.replace(/^55/,'').slice(0,2)===y.replace(/^55/,'').slice(0,2);
}

// Escolhe a conta de QR Code da tela que este motor espelha: a do mesmo número; se o número
// ainda não é conhecido ou nenhuma bate, só aceita quando existe UMA conta de QR Code.
export function escolherConta(contas,telefone){
  const qr=(contas||[]).filter(conta=>conta.provedor==='baileys');
  if(telefone){const igual=qr.find(conta=>mesmoNumero(conta.telefone,telefone));if(igual)return igual;}
  return qr.length===1?qr[0]:null;
}

export async function criarEspelho({configFile=ESPELHO_CONFIG(),log=()=>{},read=readFile,makeClient=createDeviceClient,adapterFactory=createBaileysAdapter,intervalMs=3000}={}){
  let config;
  try{config=JSON.parse(await read(configFile,'utf8'));}catch{return null;}// computador não ligado à tela: espelho desligado
  const key=await read(config.keyFile);if(key.length!==32)throw new Error('Chave do espelho inválida.');
  const client=makeClient(config);
  let socket=null,isOpen=()=>false,timer=null,stopped=false,avisado='',ultimoErro='';
  const telefone=()=>digits(socket?.user?.id?.split(':')[0]?.split('@')[0]);
  const filtrado={...client,call:async(operation,data)=>{
    const result=await client.call(operation,data);
    if(operation!=='contas')return result;
    const conta=escolherConta(result.contas,telefone());
    const motivo=conta?'':(result.contas||[]).some(c=>c.provedor==='baileys')?'mais de uma conta de QR Code e nenhuma com o número deste WhatsApp':'nenhuma conta de QR Code na tela (clique em Adicionar número)';
    if(motivo!==avisado){avisado=motivo;log(motivo?`ESPELHO_AGUARDANDO=${motivo}`:`ESPELHO_CONTA=ok`);}
    return {...result,contas:conta?[conta]:[]};
  }};
  const runtime=new MultiAccountRuntime({client:filtrado,key,spool:new DurableSpool(path.join(config.stateDir,'spool')),
    inbox:new RawInbox(path.join(config.stateDir,'inbox'),key),draftProvider:config.draftProvider,log:message=>log(`ESPELHO ${message}`),
    adapterFactory:args=>adapterFactory({...args,externalSocket:{current:()=>socket,isOpen:()=>isOpen()}})});
  async function loop(){
    if(stopped)return;
    try{await runtime.tick();if(ultimoErro){ultimoErro='';log('ESPELHO_BANCO=ok');}}
    catch(error){const texto=String(error?.message||error).slice(0,200);if(texto!==ultimoErro){ultimoErro=texto;log(`ESPELHO_ERRO=${texto}`);}}// sem repetir a cada ciclo
    if(!stopped){timer=setTimeout(()=>void loop(),intervalMs);timer.unref?.();}
  }
  void loop();
  log('ESPELHO=LIGADO');
  return {
    // O motor chama a cada socket novo (inclusive reconexão). O adaptador troca os ouvintes no próximo ciclo.
    attach(sock,{open=()=>false}={}){socket=sock;isOpen=open;},
    async stop(){stopped=true;clearTimeout(timer);await runtime.stop().catch(()=>{});},
  };
}
