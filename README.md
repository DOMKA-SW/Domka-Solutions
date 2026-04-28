# DOMKA — Plataforma (HTML + Firebase + Vercel)

Este repositorio contiene el sistema DOMKA con:
- **Portal Empresa** (dashboard, clientes, cotizaciones, proyectos, documentos)
- **Portal Cliente** (cotizaciones, proyectos, documentos)
- **Cotizaciones públicas** con link para WhatsApp y PDF con estilo DOMKA
- **Firebase** (Auth + Firestore)
- Despliegue recomendado en **Vercel**

## 1) Estructura rápida
- `index.html`: landing + login
- `dashboard.html`, `clientes.html`, `cotizaciones.html`, `proyectos.html`, `documentos.html`: portal empresa
- `cliente/`: portal cliente
  - `cliente/login.html`: registro/login del cliente + vinculación con código
  - `cliente/index.html`: home del portal cliente
- `public/cotizacion.html`: vista pública (sin login) usando `publicQuotes/{id}`
- `js/`: lógica de Firebase, auth, roles y módulos
- `firebase/`: reglas sugeridas (`firestore.rules`)
- `docs/firebase-modelo.md`: modelo de datos recomendado

## 2) Crear proyecto Firebase
En Firebase Console:
- **Authentication** → habilitar **Email/Password**
- **Firestore** → crear base de datos (modo producción recomendado)
Luego copia tu configuración (web app) en `js/firebase.js`.

## 3) Colecciones Firestore (mínimo)
Crear/usar estas colecciones:

### `users`
- Documento: `users/{uid}`
- Campos:
  - `role`: `admin|comercial|finanzas|rrhh|client`
  - `clienteId` (solo client)
  - `nombre`, `email`

### `clientes`
- CRUD desde `clientes.html`
- Al generar código de portal se crea además `clientInvites/{code}`

### `clientInvites`
- Documento: `clientInvites/{code}`
- Se crea desde portal empresa (botón **Generar código** en `clientes.html`)
- Se consume desde `cliente/login.html` para vincular la cuenta del cliente

### `cotizaciones` (privado) y `publicQuotes` (público)
- `cotizaciones/{id}`: documento interno (staff) + `linkPublico`
- `publicQuotes/{id}`: documento sanitizado con `enabled=true` para lectura pública
- La vista pública `public/cotizacion.html` lee desde `publicQuotes`

### `proyectos`
- `proyectos/{id}`: contiene `evidencias[]` en base64 (Firestore)

### `documentos`
- `documentos/{id}`: contiene `pdfBase64`

## 4) Reglas (Firestore)
Este repo incluye reglas sugeridas:
- `firebase/firestore.rules`

Puedes copiarlas en Firebase Console:
- Firestore → Rules

## 5) Despliegue en Vercel
1. Sube este repo a GitHub.
2. En Vercel: **New Project** → Importa el repo.
3. Framework: **Other** (Static).
4. Build command: vacío.
5. Output directory: vacío (root).
6. Deploy.

Los links públicos se generan automáticamente con el dominio de Vercel usando `js/config.js`:
- `PUBLIC_BASE_URL = window.location.origin`
- Public quote: `/public/cotizacion.html?id=<id>`

## 6) Flujo de uso (MVP)
### Staff (empresa)
- Inicia sesión en `index.html`.
- Crea clientes en `clientes.html`.
- Para que un cliente tenga portal:
  - En `clientes.html` abre el cliente y pulsa **Generar código**
  - Envía ese código al cliente
- Crea cotizaciones en `cotizaciones.html`:
  - El sistema guarda `linkPublico` (Vercel) + publica `publicQuotes/{id}`
  - Puedes enviar por WhatsApp desde el listado
- Sube evidencias en `proyectos.html` (base64 en Firestore) dentro del detalle del proyecto
- Crea documentos en `documentos.html` y adjunta PDF (base64 en Firestore)

### Cliente
- Entra a `cliente/login.html`
  - Si no tiene cuenta: se registra y pega el **código**
  - Queda vinculado a su `clienteId`
- Navega `cliente/index.html` y módulos

## 7) Estado actual (estabilizado)
- Separación de acceso:
  - Portal empresa: `index.html` -> `dashboard.html` por roles.
  - Portal cliente: `cliente/login.html` -> `cliente/index.html`.
- Modelo de usuarios unificado en Firestore:
  - `users/{uid}` con campos `role`, `activo`, `clienteId`, `nombre`, `email`.
- Módulo de administración:
  - `usuarios.html` + `js/usuarios.js` para crear/editar usuarios y activar/desactivar acceso.
- Reglas:
  - Publica las reglas de `firebase/REGLAS_FIRESTORE.txt` en Firestore Rules.
