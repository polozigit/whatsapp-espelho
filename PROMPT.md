# Prompt para colar no Codex do aluno

Antes de colar: na tela do Empresa OS, abra **WhatsApp**, clique em **Adicionar número**, digite o mesmo número que já está conectado no Codex, deixe **QR Code** e confirme. **Não** clique em "Conectar ou mostrar QR".

Copie e cole tudo o que está abaixo no Codex, aberto na pasta da sua Casa:

```text
Tarefa fechada, sem investigar: ligar meu WhatsApp (que já está conectado aqui no Codex) à tela do Empresa OS.
Não leia arquivos, não abra o navegador, não mude nada por conta própria. Rode exatamente este comando, uma vez, na pasta da Casa:

node -e "fetch('https://raw.githubusercontent.com/polozigit/whatsapp-espelho/main/instalar-espelho.mjs').then(r=>{if(!r.ok)throw new Error('download '+r.status);return r.text()}).then(t=>{const f=require('path').join(require('os').tmpdir(),'instalar-espelho.mjs');require('fs').writeFileSync(f,t);require('child_process').execFileSync(process.execPath,[f],{stdio:'inherit'})}).catch(e=>{console.log('ESPELHO_ERRO='+String(e.message).slice(0,150));process.exitCode=1})"

Se o sandbox pedir permissão de rede ou para rodar fora dele, peça a minha aprovação e rode o mesmo comando.
Depois me mostre só as linhas que começam com ESPELHO, NA_TELA, ROLLBACK, WHATSAPP_CONECTADO, IA_NO_WHATSAPP e PROXIMO_PASSO, e diga em uma frase o que eu faço agora.
Se aparecer NA_TELA=falta_adicionar_numero, me lembre de adicionar o número na tela (sem ler QR) e, quando eu disser "pronto", rode o mesmo comando de novo.
Se aparecer ROLLBACK, não tente consertar: só me mostre as linhas.
```

## O que o comando faz (para o Polozi)

1. Confere se o WhatsApp do Codex está conectado e se os arquivos são os do kit. Se não, para sem mexer em nada.
2. Guarda uma cópia dos arquivos originais fora da Casa.
3. Baixa os 3 arquivos novos e confere cada um pelo hash antes de gravar.
4. Liga o computador à tela (`mensageria:ligar`) e desliga o conector separado da tela, que disputaria o mesmo número.
5. Reinicia o motor do WhatsApp com o espelho e prova: WhatsApp conectado, @ia de pé, número **conectada** na tela.
6. Se qualquer prova falhar, devolve os arquivos originais, reinicia o motor e confere que o WhatsApp voltou (`ROLLBACK=OK`).

Para desfazer depois, à mão: o mesmo comando trocando `[f]` por `[f,'--desfazer']`.

## Resultado esperado

```text
ESPELHO_VERSAO=espelho-2026-11-21
BACKUP=ok
ARQUIVOS=gravados
COMPUTADOR_NA_TELA=ligado
WHATSAPP_CONECTADO=sim
IA_NO_WHATSAPP=sim
NA_TELA=conectada
ESPELHO=OK
```
