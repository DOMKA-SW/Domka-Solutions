# DOMKA — Modelo de datos (Firebase)

Este documento describe el **esquema recomendado** en Firestore para soportar:
- Portal Empresa (roles)
- Portal Cliente
- Cotizaciones con link público para WhatsApp
- Proyectos y documentos

## Colecciones (Firestore)

### `users/{uid}`
Perfil del usuario autenticado (complementa Firebase Auth).

- `role`: `admin | comercial | finanzas | rrhh | client`
- `nombre`: string (opcional)
- `clienteId`: string (solo si `role == "client"`)
- `status`: `active | disabled` (opcional)
- `createdAt`: timestamp (opcional)

### `clientes/{clienteId}`
Cliente del negocio.

- `nombre`: string
- `email`: string
- `telefono`: string
- `empresa`: string
- `tipoIdentificacion`: `CC | NIT | CE | Pasaporte | TI`
- `identificacion`: string
- `createdAt`: timestamp
- `createdByUid`: string

Compatibilidad legacy (actual): `nit`, `numeroDocumento`.

### `cotizaciones/{cotizacionId}`
Documento interno (solo staff) + referencia a link público.

- `clienteId`: string
- `nombreCliente`: string
- `telefono`: string
- `items`: array
- `tipoCalculo`: `por-items | valor-total`
- `subtotal`: number
- `total`: number
- `notas`: string
- `notasArray`: string[]
- `formaPago`: string
- `planPagos`: array
- `estado`: `pendiente | enviada | aprobada | rechazada`
- `createdAt`: timestamp
- `createdByUid`: string
- `publicQuoteId`: string (id del doc en `publicQuotes`) — recomendado

### `publicQuotes/{publicQuoteId}`
Versión **sanitizada** para lectura pública (sin auth). Esta colección es la que consume `/public/cotizacion.html`.

- `enabled`: boolean
- `cotizacionId`: string (ref)
- `numero`: string (opcional: `id.substring(0,8)`)
- `clienteId`: string (opcional, si quieres auditoría)
- `nombreCliente`: string
- `fecha`: timestamp
- `tipo`, `formaPago`, `planPagos`
- `ubicacion`
- `items`, `subtotal`, `total`
- `notas`, `notasArray`
- `mostrarDocumento`: boolean
- `clienteTipoIdentificacion`, `clienteIdentificacion` (solo si mostrarDocumento)
- `anexos`: array en base64 (`name`, `contentType`, `base64`, `size`)

### `proyectos/{proyectoId}`
- `clienteId`: string
- `nombre`: string
- `descripcion`: string
- `estado`: `activo | pausado | finalizado`
- `evidencias[]`: `{ name, contentType, base64, size, uploadedAt }`
- `createdAt`, `createdByUid`

