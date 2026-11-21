# WhatsApp na tela do Empresa OS (espelho)

Para alunos do Mestre das IAs que **já conectaram o WhatsApp pelo Codex** e querem ver o mesmo número na tela do Empresa OS, sem ler QR Code de novo.

O WhatsApp continua funcionando como antes (@ia, rotinas, grupos, volta sozinho quando o computador reinicia). A tela passa a mostrar as mensagens novas e consegue enviar pela mesma conexão.

**Como usar:** no Codex, aberto na pasta da Casa, mande: `Leia https://raw.githubusercontent.com/polozigit/whatsapp-espelho/main/CODEX.md e siga.` Detalhes em [PROMPT.md](PROMPT.md).

Segurança:
- O comando não imprime chave, token, endereço do banco nem número completo.
- Não copia nem apaga a sessão do WhatsApp: ela continua só no computador do aluno.
- Cada arquivo baixado é conferido por hash antes de ser gravado.
- Se qualquer verificação falhar, tudo volta ao estado anterior sozinho.
