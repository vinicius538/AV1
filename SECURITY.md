# Arquitetura de segurança

## Credenciais e sessões

Cada senha recebe um salt aleatório próprio de 16 bytes e é resumida com SHA-256. A verificação compara os resumos em tempo constante. A escolha segue o requisito da atividade. SHA-256 é rápido demais para armazenar senhas em sistemas de produção; nesse contexto, use uma função de derivação lenta, como scrypt, Argon2id ou PBKDF2, conforme a política do ambiente.

O administrador inicial define usuário e senha durante o provisionamento. A senha não é armazenada em texto claro: a credencial inicial é cifrada no arquivo mestre e as credenciais de uso ficam no repositório cifrado. O arquivo mestre precisa conter a chave que protege os dados; por isso, sua confidencialidade depende também das permissões da pasta. O arquivo é criado com modo `0600` em POSIX. No Windows, aplique uma ACL que permita acesso somente à conta que executa o GreenCode.

Uma sessão vence 30 minutos depois da última atividade. Cada comando autenticado valida e renova a sessão. O logout remove a sessão ativa. A CLI solicita senhas fora do histórico e sem eco quando executada em um terminal interativo.

## Dados e integridade

O repositório cifra credenciais, organizações, lotes, equipamentos e movimentações com AES-256-GCM. O modo GCM autentica o conteúdo; uma chave errada ou alteração nos dados causa erro de decifragem. Cada substituição de arquivo grava primeiro um temporário exclusivo e depois o renomeia para o destino. A operação deixa o arquivo antigo disponível até o ponto da troca.

Antes de cada alteração de entidade, o repositório anexa ao journal uma transação cifrada contendo operação, entidade, estado anterior, estado novo e usuário responsável. Os registros são append-only; ao ultrapassar 10 MB, o arquivo atual é rotacionado. Arquivos rotacionados com mais de 180 dias são removidos. O journal dá rastreabilidade e evidência da intenção de escrita.

**Limitação atual:** o GreenCode não reaplica automaticamente uma transação pendente após uma interrupção. A implementação precisa de marcadores de início e confirmação para distinguir uma escrita incompleta de um registro já aplicado. Reaplicar todo o histórico sem essa distinção poderia sobrescrever dados válidos; portanto, o journal deve ser inspecionado manualmente em caso de interrupção durante uma gravação.

## Regras de acesso e validação

- `ADMINISTRADOR`: gestão de usuários e parâmetros globais, além das operações dos demais papéis.
- `OPERADOR_CADASTRO`: cadastro e consulta de organizações.
- `GESTOR_ALMOXARIFADO`: lotes, equipamentos, triagem e movimentações.
- `AUDITOR`: consulta de lotes, relatórios e rastreabilidade.

As regras são aplicadas tanto na exibição do menu quanto no processamento dos comandos. CNPJ é validado pelos dígitos verificadores e não pode se repetir. Lotes aceitam datas de hoje até 90 dias atrás. O status `EM_DESMONTE` exige triagem concluída. Queda de duas ou mais categorias no estado físico exige justificativa.

## Cenários de falha cobertos

`npm test` verifica os seguintes casos:

- conteúdo cifrado adulterado ou decifrado com chave incompatível;
- arquivo mestre alterado, sem regeneração silenciosa da chave;
- senha incorreta, CNPJ inválido ou repetido e data de lote futura;
- tentativa de desmonte antes da triagem;
- queda grande do estado físico sem justificativa;
- tentativa de comando administrativo por papel sem permissão;
- alíquota fora do intervalo permitido;
- rotação do journal ao ultrapassar 10 MB;
- substituição atômica sem temporários sobrando após uma gravação concluída.

Os testes não simulam perda de energia ou falha abrupta do sistema de arquivos no meio de uma escrita. Também não validam a recuperação automática do journal, que permanece pendente.
