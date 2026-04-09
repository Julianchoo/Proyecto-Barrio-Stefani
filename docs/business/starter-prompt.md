I'm working with an agentic coding boilerplate project that includes authentication, database integration, and AI capabilities. Here's what's already set up:

## Current Agentic Coding Boilerplate Structure

- **Authentication**: Better Auth with Google OAuth integration
- **Database**: Drizzle ORM with PostgreSQL setup
- **AI Integration**: Vercel AI SDK with OpenAI integration
- **UI**: shadcn/ui components with Tailwind CSS
- **Current Routes**:
  - `/` - Home page with setup instructions and feature overview
  - `/dashboard` - Protected dashboard page (requires authentication)
  - `/chat` - AI chat interface (requires OpenAI API key)

## Important Context

This is an **agentic coding boilerplate/starter template** - all existing pages and components are meant to be examples and should be **completely replaced** to build the actual AI-powered application.

### CRITICAL: You MUST Override All Boilerplate Content

**DO NOT keep any boilerplate components, text, or UI elements unless explicitly requested.** This includes:

- **Remove all placeholder/demo content** (setup checklists, welcome messages, boilerplate text)
- **Replace the entire navigation structure** - don't keep the existing site header or nav items
- **Override all page content completely** - don't append to existing pages, replace them entirely
- **Remove or replace all example components** (setup-checklist, starter-prompt-modal, etc.)
- **Replace placeholder routes and pages** with the actual application functionality

### Required Actions:

1. **Start Fresh**: Treat existing components as temporary scaffolding to be removed
2. **Complete Replacement**: Build the new application from scratch using the existing tech stack
3. **No Hybrid Approach**: Don't try to integrate new features alongside existing boilerplate content
4. **Clean Slate**: The final application should have NO trace of the original boilerplate UI or content

The only things to preserve are:

- **All installed libraries and dependencies** (DO NOT uninstall or remove any packages from package.json)
- **Authentication system** (but customize the UI/flow as needed)
- **Database setup and schema** (but modify schema as needed for your use case)
- **Core configuration files** (next.config.ts, tsconfig.json, tailwind.config.ts, etc.)
- **Build and development scripts** (keep all npm/pnpm scripts in package.json)

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS
- Better Auth for authentication
- Drizzle ORM + PostgreSQL
- Vercel AI SDK
- shadcn/ui components
- Lucide React icons

## Component Development Guidelines

**Always prioritize shadcn/ui components** when building the application:

1. **First Choice**: Use existing shadcn/ui components from the project
2. **Second Choice**: Install additional shadcn/ui components using `pnpm dlx shadcn@latest add <component-name>`
3. **Last Resort**: Only create custom components or use other libraries if shadcn/ui doesn't provide a suitable option

The project already includes several shadcn/ui components (button, dialog, avatar, etc.) and follows their design system. Always check the [shadcn/ui documentation](https://ui.shadcn.com/docs/components) for available components before implementing alternatives.

## What I Want to Build

Estamos haciendo el Proyecto Barrio Stefani, un proyecto de loteo en el municipio de Moreno, Provincia de Buenos Aires
Son cerca de 360 lotes, de entre 230 y 400m2
Sobre la Ruta Provincial 24, frente a la cerámica Juan Stefani, https://maps.app.goo.gl/dSVZwbWjYcpDp73Z9
Quiero una buena página para mostrar el proyecto, y llevando a los usuarios a llenar un form de contacto

Backend
En el back, necesito una base de leads, y una base de lotes
Para los lotes te subí el listado completo de parcelas y pricing (se llama así)
A la base de parcelas hay que agregarle estos campos, por ahora todos vacios: Nombre comprador	DNI / CUIT	Teléfono	Email comprador	Nombre corredor	Email corredor	Forma de pago	Fecha reserva	Fecha vencimiento	Modificado por	Observaciones

Los usuarios pueden ser rol admin o rol comercial
El admin puede crear usuarios nuevos con ambos roles, cambiar datos de los leads, de los lotes, etc
El comercial puede cambiar el status de leads, el status de los lotes y agregar o cambiar los datos del comprador y reserva que te pasé arriba

Algunas faqs que podemos incluir
¿Dónde se encuentra ubicado el loteo?
El Barrio Stefani se encuentra en Cuartel V, Moreno, frente a la fábrica de cerámica Juan Stefani. Una zona residencial tranquila en pleno desarrollo, con excelente acceso a rutas principales y cercanía a servicios, colegios y comercios.
¿Qué tamaños tienen los lotes disponibles?
Contamos con lotes entre 230 y 399 metros cuadrados aproximadamente, ideales para construir la casa de tus sueños en un barrio planificado con infraestructura completa.
¿Se puede financiar la compra del lote?
¡Sí! Ofrecemos financiación de hasta 60 cuotas sin interés. Además, tenemos opciones de pago al contado a valor promocional para quienes prefieren aprovechar el mejor precio.
¿Qué servicios están disponibles en el loteo?
El barrio contará con: Red eléctrica aérea de media tensión (EDENOR), 120 luminarias LED, desagües pluviales por zanjas a cielo abierto con 14 pases hidráulicos, calles internas con sub base compactada y terminación en piedra partida, boulevard central de 4150m², y sistema de efluentes mediante biodigestores individuales. El agua será mediante perforación individual en cada lote.
¿Cuándo estarán listos los lotes para construir?
La entrega de los lotes está proyectada para fines de 2026, una vez finalizadas todas las obras de infraestructura que incluyen 14.130m² de calles, el boulevard, iluminación LED y sistema de drenaje pluvial completo
¿Es posible visitar el lote antes de comprar?
¡Por supuesto! Coordinamos visitas al terreno para que puedas recorrer el loteo, conocer la ubicación y elegir el lote que más te convenga. Contactanos para agendar tu visita.


Haceme una linda hero section, con tarjetas y buena ui de shadcn
Tu Hogar Rodeado de Naturaleza
Barrio Stefani ofrece amplios espacios verdes y un boulevard central diseñado para disfrutar al aire libre

Boulevard Central
4.150 m² de espacios verdes

Áreas de Recreación
Espacios diseñados para la familia

Entorno Natural
10 hectáreas de desarrollo sustentable

Un Barrio Pensado para Vivir
Boulevard central de más de 4.000 m² para paseos y actividades
Calles internas con iluminación LED de última generación
Diseño urbano moderno con espacios de circulación amplios
Ubicación frente a la histórica fábrica de cerámica Juan Stefani
🌳
Aire Puro y Tranquilidad
Disfrutá de la calidad de vida que siempre soñaste en un entorno natural privilegiado

Ubicación Estratégica
Cuartel V, Moreno - Frente a Cerámica Juan Stefani

Características del Barrio
10 Hectáreas
Superficie total del desarrollo

Lotes 250-399 m²
Tamaños ideales para tu proyecto

Ubicación Premium
Frente a fábrica Juan Stefani, zona en desarrollo

Accesos y Conectividad
Excelente acceso desde rutas principales

Cercanía a centros comerciales y servicios

Escuelas y colegios en la zona

Transporte público disponible

Zona residencial consolidada y segura

Un lugar ideal para construir tu futuro, con toda la infraestructura necesaria y en constante crecimiento

## Request

Please help me transform this boilerplate into my actual application. **You MUST completely replace all existing boilerplate code** to match my project requirements. The current implementation is just temporary scaffolding that should be entirely removed and replaced.

## Final Reminder: COMPLETE REPLACEMENT REQUIRED

🚨 **IMPORTANT**: Do not preserve any of the existing boilerplate UI, components, or content. The user expects a completely fresh application that implements their requirements from scratch. Any remnants of the original boilerplate (like setup checklists, welcome screens, demo content, or placeholder navigation) indicate incomplete implementation.

**Success Criteria**: The final application should look and function as if it was built from scratch for the specific use case, with no evidence of the original boilerplate template.

## Post-Implementation Documentation

After completing the implementation, you MUST document any new features or significant changes in the `/docs/features/` directory:

1. **Create Feature Documentation**: For each major feature implemented, create a markdown file in `/docs/features/` that explains:

   - What the feature does
   - How it works
   - Key components and files involved
   - Usage examples
   - Any configuration or setup required

2. **Update Existing Documentation**: If you modify existing functionality, update the relevant documentation files to reflect the changes.

3. **Document Design Decisions**: Include any important architectural or design decisions made during implementation.

This documentation helps maintain the project and assists future developers working with the codebase.
