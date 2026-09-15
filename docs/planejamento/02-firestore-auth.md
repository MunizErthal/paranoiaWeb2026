# 02 — Integração Firestore: segurança, autenticação, cadastro e perfil

> Documento de planejamento. Revisa o que já foi implementado (`AuthService`, `AuthStateService`, `UsuarioService`, `FirebaseBaseService`) com foco em segurança, e desenha login, cadastro (com campos novos) e a base do perfil.

## Contexto importante

O código em `src/shared/` foi copiado de outro projeto que usa **o mesmo banco Firebase**. Os dois sistemas são independentes — este projeto pode (e deve) alterar livremente o código Angular (rotas, services, guards), mas **não deve remover ou corromper campos que o outro sistema já usa** na coleção `usuarios` (`partidas`, `partidaEmAndamento`, `permissoes`). Esses campos ficam preservados no `UsuarioDTO`, só não são geridos ativamente por este projeto.

## Auditoria do que já existe

| # | Problema encontrado | Onde | Risco |
|---|---|---|---|
| 1 | `AuthStateService` muta `environment.prod.ts` em runtime (`environment.usuarioAtual = usuario`) | `auth-state.service.ts` | Mistura config de build (deveria ser estática) com estado de sessão (mutável). Estado global fora de um mecanismo reativo real. |
| 2 | `AuthService` importa `environment` (dev); `AuthStateService` importa `environment.prod` | `auth.service.ts` linha 15 vs `auth-state.service.ts` linha 4 | Os dois arquivos podem enxergar objetos de configuração diferentes dependendo do build — inconsistência real, não hipotética. |
| 3 | Usuário completo (incluindo `permissoes`) salvo em `localStorage` em texto plano | `auth-state.service.ts` | Dado editável pelo próprio usuário via DevTools. Não deve ser usado como fonte de autorização. |
| 4 | Não existe `firestore.rules` versionado no repo | (ausente) | Ninguém tem visibilidade/controle de versão sobre o que está de fato protegido no banco de produção. |
| 5 | `console.log(code)` do erro do Firebase Auth | `auth.service.ts:180` | Vazamento de detalhe de diagnóstico no console em produção (baixo risco, mas desnecessário). |
| 6 | Autorização (`permissoes`) é um campo comum do Firestore, editável pelo dono do documento se a regra não for rigorosa | `usuario.dto.ts` | Se a regra do Firestore permitir `update` do próprio doc sem excluir o campo `permissoes`, o usuário pode se autopromover. |

## Correções propostas

### 1. Eliminar o estado mutável em `environment`

`environment.ts` / `environment.prod.ts` passam a conter **só configuração estática de build** (config do Firebase). Os campos `usuarioAtual` e `partidaId` saem de lá.

```ts
// environment.ts — depois da mudança
export const environment = {
  firebase: { apiKey: '...', authDomain: '...', /* ... */ },
};
```

Estado de sessão passa a viver inteiramente no `AuthStateStore` (ver abaixo), que é a única fonte de verdade em tempo de execução.

### 2. `AuthStateService` → `AuthStateStore` (signals)

Substitui `BehaviorSubject` por signals (decisão tomada em conjunto com o padrão do [MD 01](./01-padroes-componentes-services.md)):

```ts
@Injectable({ providedIn: 'root' })
export class AuthStateStore {
  private readonly _usuario = signal<UsuarioDTO | null>(this.carregarDoLocalStorage());

  readonly usuario = this._usuario.asReadonly();
  readonly estaAutenticado = computed(() => this._usuario() !== null);

  setUsuario(usuario: UsuarioDTO | null): void { /* atualiza signal + localStorage (só cache, nunca fonte de autorização) */ }
  limpar(): void { this.setUsuario(null); }
}
```

O que vai pro `localStorage` aqui é **cache de UI** (nome, foto, e-mail — pra não piscar tela vazia no primeiro render). Qualquer decisão de autorização (o que o usuário pode ler/escrever) depende sempre do token do Firebase Auth validado pelas regras do Firestore — nunca do valor lido do `localStorage`.

### 3. Regras de segurança do Firestore (`firestore.rules`)

Arquivo novo, versionado no repo (aplicado manualmente no console do Firebase até o `firebase-tools`/CI ser configurado — está fora do escopo deste documento, mas fica registrado como pendência).

Estrutura de coleções (decidida no planejamento — ver também [03](./03-carrinho-pagamento-frete.md)):

```
usuarios/{uid}                        — identidade + jogosAdquiridos[]
usuarios/{uid}/perfil/dados           — CPF, telefone, nome completo, data nasc.
usuarios/{uid}/enderecos/{enderecoId} — endereços de entrega
produtos/{produtoId}                  — catálogo (público pra leitura)
compras/{compraId}                    — pedidos (campo usuarioId)
```

Regras (esqueleto):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function ehDono(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    match /usuarios/{uid} {
      allow read: if ehDono(uid);
      // 'permissoes' nunca é editável pelo client — só por Cloud Function (Admin SDK, ignora regras)
      allow update: if ehDono(uid)
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['permissoes', 'jogosAdquiridos']);
      allow create: if ehDono(uid);

      match /perfil/{doc} {
        allow read, write: if ehDono(uid);
      }
      match /enderecos/{enderecoId} {
        allow read, write: if ehDono(uid);
      }
    }

    match /produtos/{produtoId} {
      allow read: if true;           // catálogo é público
      allow write: if false;         // só Cloud Function (Admin SDK)
    }

    match /compras/{compraId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.usuarioId;
      allow write: if false;         // client NUNCA escreve pedido — evita "marcar como pago" fraudado
    }
  }
}
```

Pontos-chave:
- **`compras` é somente leitura pro client.** Todo pedido é escrito pelas Cloud Functions de pagamento e pelos webhooks do Mercado Pago/Melhor Envio (Admin SDK ignora as regras). Isso fecha a maior brecha de fraude possível (usuário criar/editar um pedido "pago" direto no Firestore).
- **`produtos` é só leitura pro client.** Catálogo é mantido por administração direta no console/Cloud Function — nunca pelo navegador (ver MD 03).
- **`permissoes` e `jogosAdquiridos` ficam fora do alcance de update do próprio dono** — só Cloud Function/Admin SDK escreve.

### 4. Autorização de admin: Custom Claims em vez de campo no documento

Para qualquer decisão de "é admin?" no futuro (ex: painel de gestão de produtos), a recomendação é usar **Firebase Auth Custom Claims** em vez do array `permissoes` do Firestore — claims são assinadas pelo próprio Firebase e só podem ser setadas via Admin SDK (Cloud Function), nunca pelo client. Isso já está viabilizado porque o [MD 03](./03-carrinho-pagamento-frete.md) já traz Cloud Functions pro projeto (decisão tomada no planejamento). Não é bloqueante agora — fica documentado como padrão a seguir quando a primeira necessidade de admin aparecer.

### 5. Limpeza de baixo risco

- Remover `console.log(code)` de `handleError` (ou condicionar a `!environment.production` se um dia precisar de debug).

## Modelos de dados

```ts
// usuario.dto.ts — ajustado
export interface UsuarioDTO {
  id: string;
  email: string;
  nome?: string;
  foto?: string;
  criadoEm: Date;
  ultimoLoginEm?: Date;
  ativo: boolean;
  permissoes?: string[];        // legado do outro sistema — não gerido aqui
  partidaEmAndamento?: string;  // legado do outro sistema — não gerido aqui
  partidas: string[];           // legado do outro sistema — não gerido aqui
  jogosAdquiridos?: JogoAdquirido[]; // NOVO — atualizado só por Cloud Function
}

export interface JogoAdquirido {
  produtoId: string;
  nome: string;
  dataCompra: string; // ISO
  compraId: string;   // referência ao doc em compras/
}

// perfil.dto.ts — NOVO (usuarios/{uid}/perfil/dados)
export interface PerfilDTO {
  nomeCompleto?: string;
  cpf?: string;          // opcional até o checkout exigir
  telefone?: string;
  dataNascimento?: string;
}

// endereco.dto.ts — NOVO (usuarios/{uid}/enderecos/{id})
export interface EnderecoDTO {
  id: string;
  apelido?: string;       // "Casa", "Trabalho"
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  padrao: boolean;
}
```

CPF fica em `PerfilDTO`, não em `UsuarioDTO` — reduz a superfície de dado sensível em queries/leituras que só precisam da identidade básica, e mantém o CPF opcional (decisão do planejamento: obrigatório só no checkout, nunca no cadastro).

## Fluxo de cadastro e login

- **Cadastro** (`/cadastro`): e-mail, senha, nome. CPF **não** é pedido aqui (fica pro checkout). Verificação de e-mail continua obrigatória (já implementado) antes de liberar login.
- **Login** (`/login`): e-mail/senha ou Google (já implementado). Pós-login: se havia uma `returnUrl` (ex: veio de "finalizar compra"), volta pra lá; senão vai pro `/perfil`.
- **Esqueci senha** (`/esqueci-senha`): usa `resetPassword` já existente no `AuthService`.
- Nenhuma tela de "seleção de partida" é criada aqui — isso pertence ao outro sistema.

## Checklist desta etapa

- [ ] Remover `usuarioAtual`/`partidaId` de `environment.ts`/`environment.prod.ts`
- [ ] Criar `AuthStateStore` (signals) substituindo `AuthStateService`
- [ ] Corrigir `AuthService` pra importar sempre `./environment` (nunca `.prod` direto)
- [ ] Escrever `firestore.rules` e aplicar no console do Firebase
- [ ] Criar `PerfilDTO`, `EnderecoDTO`, ajustar `UsuarioDTO` (+ `jogosAdquiridos`)
- [ ] Criar `PerfilService`/`EnderecoService` (sobre `FirebaseBaseService`, seguindo o padrão do MD 01)
- [ ] Telas: `/login`, `/cadastro`, `/esqueci-senha`
- [ ] Remover `console.log(code)` de `handleError`
- [ ] Documentar (não implementar ainda) o plano de Custom Claims pra admin
