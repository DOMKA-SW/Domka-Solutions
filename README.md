# DOMKA SOLUTIONS S.A.S

Arquitectura modular en 3 capas:

1. Web publica: `index.html`
2. Portal empresa: `empresa/index.html`
3. Portal cliente: `cliente/index.html`

## Stack

- HTML + CSS + JavaScript (Vanilla, modulos ES)
- Firebase Auth + Firestore
- Vercel para deploy (`vercel.json`)

## Estructura principal

- `css/app.css`: estilos base y portales
- `js/core/firebase-config.js`: inicializacion Firebase
- `js/core/auth-guard.js`: autenticacion y sanitizacion
- `js/core/firestore-service.js`: capa de acceso a Firestore
- `js/modules/admin.js`: dashboard empresa y gestion de empleados, nomina, proyectos, clientes
- `js/modules/client-portal.js`: vista cliente para estado, documentos, evidencias
- `firebase/firestore.rules`: reglas de seguridad por rol

## Modulos incluidos

- Gestion de nomina (sin cuentas de cobro)
- Registro de empleados (1-10 o mas)
- Proyectos con estado y enlaces de documentos/evidencias
- Portal cliente con autenticacion y acceso por UID

## Configuracion requerida (obligatoria)

1. Editar `js/core/firebase-config.js` con credenciales reales del proyecto Firebase.
2. Crear en Firestore la coleccion `users` con `role: "admin"` para usuarios administradores.
3. Publicar reglas de `firebase/firestore.rules` en Firebase Console.
4. Deploy en Vercel conectado al repositorio GitHub.

Si no reemplazas las keys, la app mostrara error intencional para evitar una configuracion incompleta.

## Deploy rapido (GitHub + Vercel)

1. Subir este proyecto a un repositorio GitHub.
2. Importar el repo en Vercel.
3. Framework preset: `Other`.
4. Build command: vacio.
5. Output directory: vacio.
6. Deploy.
7. Validar rutas:
   - `/`
   - `/empresa`
   - `/cliente`

## Reglas Firebase (manual por ti)

Copiar contenido de `firebase/firestore.rules` y publicarlo en Firebase Console > Firestore > Rules.

## Plantillas de usuarios (copiar y pegar)

Crear documentos en coleccion `users` con ID igual al `uid` de Firebase Auth.

### Admin (`users/{uid_admin}`)

```json
{
  "name": "Administrador DOMKA",
  "email": "admin@domka.com",
  "role": "admin",
  "active": true,
  "createdAt": 1713916800000
}
```

### Cliente (`users/{uid_cliente}`)

```json
{
  "name": "Cliente DOMKA",
  "email": "cliente@correo.com",
  "role": "client",
  "active": true,
  "createdAt": 1713916800000
}
```

Despues, en portal empresa, asigna el `uid` del cliente en el modulo **Gestion de Clientes** para enlazarlo a su proyecto.

## Nota de almacenamiento

- Archivos pequenos: base64 en Firestore (si es estrictamente necesario).
- Archivos grandes: guardar URL externa (GitHub privado, Cloudflare R2 u otro).
- El portal cliente consume enlaces del proyecto sin duplicar almacenamiento.
