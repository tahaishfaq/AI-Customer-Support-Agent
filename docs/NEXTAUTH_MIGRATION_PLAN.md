# NextAuth Migration Plan (Beginner)

**Goal:** Apna custom JWT auth hatao → **Auth.js (NextAuth v5)** use karo.  
**App:** `AI-Customer-Support-Agent`  
## Implementation status

- [x] Phase A — Install + Prisma tables + `auth.js` + `[...nextauth]`  
- [x] Phase B — Agents/analytics use `requireAuth()` → NextAuth `auth()`  
- [x] Phase C — Real NextAuth `SessionProvider` + `signIn` / `signOut` in store  
- [x] Phase D — DIY JWT (`jsonwebtoken`, `hapy_token`, login/logout/google routes) removed  
- [x] Phase E — Register → credentials session → agents + overview tested  

**Note:** Auth.js Credentials uses library-managed session cookies (`session: { strategy: "jwt" }`). That is **not** the old DIY `jsonwebtoken` / Bearer flow.

---

## Aapki baat (confirmed)

Haan — samajh aa gayi:

| Aap chahte ho | Matlab |
|---------------|--------|
| **NextAuth use karo** | Login / session / user NextAuth se |
| **JWT nahi** | Apna DIY `jsonwebtoken` + Bearer / custom token flow **hatao** |
| **Baki sab same** | Agents, analytics, UI flows, bcrypt passwords, Google — same product |
| **Session + user instance** | Baad mein `session.user` se name/email/id nikalna (agents ownership, header, etc.) |

### Important clarification — aapka current `SessionProvider`

File: `components/session/SessionProvider.jsx`

Yeh **NextAuth ka SessionProvider nahi** hai. Abhi yeh sirf wrapper hai:

- `AuthHydrate` (purana JWT / Zustand hydrate)
- `SessionExpiredOverlay`

Isliye naam “SessionProvider” hai, lekin andar **NextAuth session context nahi** chal raha.

**Migrate ke baad:**

- Isi jagah (ya `providers.jsx` mein) asli **`next-auth/react` → `SessionProvider`** lagega  
- Phir client pe `useSession()` se user milega  
- Server pe `auth()` se user milega  

Baki app same — sirf auth ka source JWT se → NextAuth session.

---

## Pehle yeh samjho (1 minute)

### Abhi kya chal raha hai?

Aap **khud** JWT bana rahe ho:

1. Login → `jsonwebtoken` se token banate ho  
2. Cookie `hapy_token` ya `Authorization: Bearer ...` bhejte ho  
3. Har API mein `getUserFromRequest` token verify karta hai  

Yeh **DIY JWT** hai. NextAuth abhi project mein **installed nahi** hai.

### NextAuth kya hai?

NextAuth (naya naam **Auth.js**) ek ready library hai jo:

- Login / logout / Google handle karti hai  
- Session cookie manage karti hai  
- Aapko har baar JWT manually sign/verify nahi karna padta  

### “JWT remove” ka matlab (default is plan mein)

| Matlab | Plan |
|--------|------|
| **Option 1 (recommended)** | Apna DIY JWT (`jsonwebtoken`, Bearer, custom cookie signing) **hatao**. NextAuth apni session cookie use kare. Email/password + Google **dono** rahenge. |
| Option 2 | Bilkul koi JWT nahi (sirf DB sessions). Email/password mushkil; mostly OAuth. |

**Yeh plan Option 1 assume karta hai** (beginner + aapka current email/password + Google).

> Note: NextAuth *andar* session ke liye JWT-style cookie use kar sakta hai. Woh **aapka** hand-made JWT nahi hai. Woh library ka standard tareeqa hai.

---

## Simple before / after

```
BEFORE                          AFTER
------                          -----
Login API → apna JWT            signIn() → NextAuth session cookie
Bearer / hapy_token             Browser cookie automatically
getUserFromRequest              auth() / useSession()
/api/auth/login, /google...     /api/auth/[...nextauth]
require-auth (DIY)              require-auth (NextAuth auth() pe)
```

---

## Kya same rahega?

- Neon + Prisma `User` table  
- Password **bcrypt** hash (Credentials sirf check karti hai)  
- Agents / analytics business logic (Phase 2)  
- Ownership: `userId` ab `session.user.id` se aayega  

## Kya change hoga?

- `jsonwebtoken` dependency / DIY token flow  
- Custom `/api/auth/login`, `/logout`, `/me`, `/google` (register alag reh sakta hai)  
- Frontend: localStorage token source of truth nahi rahega  
- Google: NextAuth Google provider (usually **Client ID + Client Secret** chahiye)

---

## Implementation phases (ek ek karke)

Har phase ke baad **checkpoint** — fail ho to next mat jao.

### Phase A — Install + config (foundation)

**Aap kya karoge / agent kya banayega:**

1. Install: `next-auth` (v5 / Auth.js) + `@auth/prisma-adapter`  
2. Prisma mein NextAuth tables add:
   - `Account`
   - `Session`
   - `VerificationToken`
   - `User` ko adapter ke saath link (relations; `passwordHash` rakho)  
3. File `auth.js` (project root ya `lib/`):
   - Provider **Credentials** → email/password → DB se user → bcrypt compare  
   - Provider **Google**  
   - Callbacks → `session.user.id` = Prisma user id (agents ke liye zaroori)  
4. Route: `app/api/auth/[...nextauth]/route.js`  
5. Env (`.env` + `.env.example`):
   - `AUTH_SECRET` (lambe random string)
   - `AUTH_URL=http://localhost:3000`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

**Checkpoint A**

- [ ] `npm run dev` chalega  
- [ ] Browser: `/api/auth/providers` → `credentials` + `google` dikhen  

---

### Phase B — APIs ko NextAuth se protect karo

Agents / analytics pehle DIY JWT se protect the. Ab:

```js
// idea (beginner)
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json(
    { error: { message: "Missing or invalid session", details: {} } },
    { status: 401 }
  );
}
// session.user.id se agents list/create
```

- `lib/require-auth.js` ko **NextAuth `auth()`** pe rewrite karo (file rakh sakte ho taake routes kam badlen)  
- Agent / overview services same rahenge  

**Checkpoint B**

- [ ] Logged out → `GET /api/agents` = **401**  
- [ ] Logged in (session cookie) → agents CRUD kaam kare  

---

### Phase C — UI: login / register / Google / logout

| Screen | Ab | Baad |
|--------|----|------|
| Register | Custom API (reh sakti hai) | User create (bcrypt) → phir `signIn("credentials")` |
| Login | `POST /api/auth/login` | `signIn("credentials", { email, password })` |
| Google | idToken → `/api/auth/google` | `signIn("google")` |
| Logout | custom logout + clear storage | `signOut()` |
| “Kaun logged in?” | Zustand + token | `useSession()` / server `auth()` |

- `SessionProvider` add (client)  
- `proxy.js` dashboard protection NextAuth session se  

**Checkpoint C**

- [ ] Register → auto/login → dashboard  
- [ ] Logout → login page  
- [ ] Refresh ke baad session rahe  
- [ ] Google button NextAuth flow se chalay  

---

### Phase D — Purana JWT code hatao (cleanup)

Sirf jab A–C pass hon:

**Delete / stop using:**

- `jsonwebtoken` (agar kahi use na ho)  
- DIY cookie/token helpers jo sirf purane auth ke liye the  
- Routes: `/api/auth/login`, `/logout`, `/me`, `/google` (agar NextAuth replace kar chuka)  
- Auth service ke Google idToken wale hisse  
- UI se Bearer / localStorage token logic  

**Keep:**

- `hashPassword` / `comparePassword`  
- Register user create  
- Prisma + agents + analytics  

**Checkpoint D**

- [ ] App mein kahi DIY `hapy_token` / Bearer login flow na bache  
- [ ] `package.json` se unused auth packages haten  

---

### Phase E — Full test checklist

- [ ] Naya user register  
- [ ] Email/password login  
- [ ] Google login  
- [ ] Refresh → abhi bhi logged in  
- [ ] Logout  
- [ ] Agents create/list bina DIY JWT  
- [ ] Overview API session se  
- [ ] Doosre user ka agent → 403/404 same  

---

## Beginner FAQ

**Q: NextAuth aur mera Phase 2 agents conflict to nahi?**  
A: Nahi. Sirf “user id kaise milti hai” change hoti hai (`session.user.id`). Agents code almost same.

**Q: Register NextAuth khud karta hai?**  
A: Nahi. Register aap Prisma se user banate ho; login NextAuth karta hai.

**Q: Postman kaise test hoga?**  
A: Pehle Bearer token easy tha. Ab browser cookie / NextAuth session. Web app ke liye browser enough hai.

**Q: `require-auth.js` kyun thi?**  
A: Woh DIY JWT pe thin wrapper thi — NextAuth nahi. Migrate ke baad wohi file `auth()` call karegi, ya hata denge.

---

## Files map (expected)

| New / update | Why |
|--------------|-----|
| `auth.js` | NextAuth config |
| `app/api/auth/[...nextauth]/route.js` | Auth endpoints |
| `prisma/schema.prisma` | Account / Session / … |
| `lib/require-auth.js` | Switch to `auth()` |
| Login / Register / Google components | `signIn` / `signOut` |
| `proxy.js` | Session-aware page guard |
| `.env.example` | `AUTH_SECRET`, Google secret |

| Remove later (Phase D) | Why |
|------------------------|-----|
| DIY JWT sign/verify flow | Replaced |
| Custom login/logout/me/google routes | Replaced |
| localStorage token as auth source | Replaced |

---

## Order jab implement karna ho

```
Phase A → checkpoint
Phase B → checkpoint
Phase C → checkpoint
Phase D → cleanup
Phase E → final test
```

**Ek phase incomplete → next mat shuru karo.**

---

## Aap se confirm (implement se pehle)

1. **Option 1** theek hai? (DIY JWT hatao, NextAuth session OK)  
2. Email/password + Google **dono** rakhne hain?  
3. Google Cloud pe **Client Secret** bana sakte ho? (NextAuth Google ke liye usually chahiye)

Jawab do → phir bolein **“implement Phase A”** (ya full migration).
