# Lead Prospector — Lweb

Herramienta interna de prospecting local para Lweb. Busca empresas en la region (Buchs SG, Werdenberg, Rheintal, Liechtenstein, St. Gallen), analiza sus webs y genera emails personalizados con GPT-4.

## Como funciona

1. Escribes una busqueda: `restaurant Buchs SG`, `coiffeur Sevelen`, `zahnarzt Werdenberg`...
2. El bot busca empresas en **local.ch** y **DuckDuckGo**
3. Visita cada web + pagina de contacto/impressum
4. Analiza: SSL, mobile, velocidad, SEO, CTA, cookies, favicon, imagenes
5. Genera un email personalizado en aleman con **GPT-4** basado en los problemas reales
6. Todo se guarda en `data/leads.json` (sin base de datos)

## Que analiza el bot

- SSL (https)
- Mobile-friendly (viewport)
- Velocidad de carga
- Titulo SEO y meta description
- Llamada a la accion (CTA) visible
- Redes sociales vinculadas
- Aviso de cookies (DSG/GDPR)
- Favicon
- Imagenes sin alt text
- CMS detectado (WordPress, Joomla, etc.)
- Email y telefono de contacto

## Stack

- **Next.js 14** — framework
- **TypeScript** — tipado
- **Tailwind CSS** — estilos
- **OpenAI GPT-4** — generacion de emails
- **Cheerio + Axios** — scraping de webs
- **JSON local** — almacenamiento en `data/leads.json`

## Estructura

```
lead-prospector/
├── .env.local              # OPENAI_API_KEY=sk-...
├── data/
│   └── leads.json          # todos los leads guardados (local)
├── src/
│   ├── lib/
│   │   ├── types.ts        # tipos de Lead
│   │   ├── leads-store.ts  # CRUD en JSON local
│   │   ├── scraper.ts      # analizar webs (SSL, mobile, speed, SEO...)
│   │   ├── search.ts       # buscar empresas en local.ch y DuckDuckGo
│   │   └── ai.ts           # generar emails con GPT-4
│   └── app/
│       ├── page.tsx         # panel principal
│       └── api/
│           ├── search/      # buscar + analizar + generar emails
│           ├── scrape/      # analizar una web individual
│           ├── leads/       # CRUD de leads + exportar CSV
│           └── generate-email/ # regenerar email con GPT-4
```

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar API key de OpenAI
# Crear archivo .env.local con:
OPENAI_API_KEY=sk-...

# 3. Arrancar
npm run dev

# 4. Abrir
# http://localhost:3003
```

## Funcionalidades del panel

- **Buscar empresas** — escribe sector + ciudad, el bot hace todo
- **6 resultados max** por busqueda, bien analizados
- **No repite** leads que ya tienes guardados
- **Score de oportunidad** — rojo = web mala = mas oportunidad
- **Email personalizado** generado automaticamente en aleman
- **Boton "Abrir en Mail"** — abre tu app de correo con el email listo
- **Regenerar Email** — genera un nuevo email para un lead
- **Marcar como Contactado / Descartar**
- **Exportar CSV** — descarga todos los leads
- **Filtros** — Todos, Nuevos, Contactados, Descartados

## Emails generados

Los emails se generan como Roberto Salvador, freelancer de Sevelen:
- Tono cercano, como un vecino ("Grüezi mitenand", "Ich bin der Roberto aus Sevelen")
- Sin jerga tecnica (nada de Next.js, React, WordPress)
- Habla del problema del cliente (Gaeste, Handy, Google)
- CTA simple: 5-10 minutos de telefono
- Firma: Roberto + Lweb + telefono + web

## Notas

- Solo para uso local/interno, no se publica en ninguna URL
- Los datos se guardan en `data/leads.json`
- Respetar las buenas practicas de contacto B2B: mensajes personalizados, no spam masivo
# lead
