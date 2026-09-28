# GreenCode

CLI acadêmica para cadastro, triagem e rastreabilidade de equipamentos eletrônicos. Requer Node.js 20 ou superior e funciona com os módulos nativos do Node em Windows e Linux.

## Instalar e executar

```text
npm install
npm run build
npm start
```

Os dados ficam em `./data`. Para escolher outra pasta:

```text
npm start -- --data-dir ./dados-greencode
```

Na primeira execução, o programa pede usuário e senha para provisionar o administrador e cria a chave mestra. A senha é solicitada sem eco no terminal. Em seguida, o sistema pede as credenciais para iniciar uma sessão. As sessões expiram após 30 minutos sem atividade; cada comando válido renova o prazo.

## Comandos

Use `ajuda` para ver os comandos permitidos para o papel autenticado. Os textos com espaços devem ficar entre aspas.

Os comandos de cadastro e atualização também podem ser iniciados sem opções. Nesse caso, o GreenCode pede os dados no terminal, um por vez. Por exemplo, `organizacao cadastrar`, `lote criar` ou `equipamento criar` abre os campos correspondentes. As opções informadas no próprio comando são aproveitadas e o programa pergunta somente o que estiver faltando.

```text
organizacao cadastrar --razao "Empresa Exemplo" --cnpj 04.252.011/0001-10 --endereco "Rua Um, 10" --telefone 11999990000 --email contato@exemplo.com
lote criar --org ORG-ID --nf NF-123 --transp "Trans Rápida"
equipamento criar --tipo NOTEBOOK --marca Marca --modelo Modelo --ano 2022 --estado USADO_LEVE --peso 2 --lote LOTE-ID --preco 1500
lote triagem LOTE-ID
equipamento status --id EQUIPAMENTO-ID --status EM_DESMONTE --justificativa "Triagem concluída"
equipamento movimentar --id EQUIPAMENTO-ID --destino "Centro de desmontagem" --obs "Coletado"
equipamento rastrear EQUIPAMENTO-ID
relatorio status
relatorio financeiro
```

O administrador também pode usar `usuario listar`, `usuario criar --usuario NOME --papel PAPEL` e `usuario senha`. A senha do novo usuário e a troca de senha são solicitadas em prompts sem eco e não entram no histórico. Os papéis aceitos são `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO` e `AUDITOR`.

Parâmetros globais são consultados com `configuracao ver` e atualizados com `configuracao atualizar --aliquota 0.18 --depreciacao 0.2`. As taxas são frações entre 0 e 1; por exemplo, `0.18` representa 18%.

## Arquivos e segurança

Organizações, credenciais, lotes, equipamentos e movimentações são gravados em arquivos cifrados com AES-256-GCM. As escritas de entidades usam arquivo temporário seguido de renomeação. Cada transação é cifrada e anexada ao journal antes da atualização do arquivo de entidade; o journal gira ao passar de 10 MB e os arquivos rotacionados com mais de 180 dias são removidos.

As senhas usam SHA-256 com salt aleatório por credencial e comparação em tempo constante. Esse algoritmo segue o requisito da atividade; para um serviço de produção, uma função lenta de derivação de senha seria mais resistente a tentativas offline.

O arquivo `greencode.master.json` contém a chave mestra necessária para abrir os arquivos e uma cópia cifrada da credencial inicial. O programa cria o arquivo com modo `0600` em sistemas POSIX, mas o modo de arquivo do Node não substitui ACLs no Windows. Restrinja o acesso a essa pasta à conta do operador do sistema e mantenha cópias de segurança protegidas.

O journal é write-ahead e permite inspecionar a última transação registrada. A aplicação ainda não reaplica automaticamente transações pendentes após uma interrupção; fazê-lo sem um marcador de confirmação poderia sobrescrever dados válidos. Esse cenário deve ser tratado como limitação até ser definida e implementada uma recuperação transacional segura.

## Arquitetura

- `classes/`: entidades de domínio, autenticação, serviços, CLI, persistência e configuração mestre.
- `enums/`: papéis, estados físicos, tipos de equipamento e estados de lote/rastreamento.
- `index.ts`: provisionamento inicial, montagem dos serviços, login e ciclo da CLI.

Veja [SECURITY.md](SECURITY.md) para a arquitetura de segurança, respostas a falhas e limitações conhecidas.

O projeto foi compilado e testado em Windows nesta execução. A implementação usa APIs portáveis do Node; a execução em Ubuntu 24.04 deve ser confirmada no ambiente Linux de entrega.
