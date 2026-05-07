# 📖 English Daily Log

Tu app personal para registrar lecciones de inglés con vocabulary, speaking y writing.

---

## 🚀 Paso a paso para publicar la app

### PASO 1 — Configurar Supabase (tu base de datos)

1. Ve a **https://supabase.com** y crea una cuenta gratis (puedes entrar con Google)
2. Haz clic en **"New Project"**
3. Ponle nombre: `english-lessons`, elige una contraseña segura y selecciona la región más cercana
4. Espera ~2 minutos a que el proyecto esté listo
5. En el panel izquierdo ve a **"SQL Editor"** → **"New Query"**
6. Copia y pega TODO el contenido del archivo `supabase-setup.sql` de este repositorio
7. Haz clic en **"Run"** (botón verde)
8. Ve a **"Project Settings"** → **"API"** y copia:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public** key (la clave larga)

---

### PASO 2 — Subir el código a GitHub

#### Opción A: Desde el navegador (más fácil) ✅

1. Abre tu repositorio en GitHub (`github.com/carlosfebresy96/english-lessons`)
2. Haz clic en **"uploading an existing file"**
3. Arrastra TODOS los archivos y carpetas de este proyecto
4. Haz clic en **"Commit changes"**

#### Opción B: Con GitHub Desktop

1. Descarga **GitHub Desktop** desde https://desktop.github.com
2. Instálalo e inicia sesión con tu cuenta de GitHub
3. Haz clic en **"Clone a repository"** → busca `english-lessons` → clona
4. Copia todos los archivos del proyecto a la carpeta que se creó
5. En GitHub Desktop verás los cambios → escribe "primer commit" → haz clic en **"Commit to main"**
6. Haz clic en **"Push origin"**

---

### PASO 3 — Publicar en Vercel

1. Ve a **https://vercel.com** y crea cuenta gratis (entra con GitHub)
2. Haz clic en **"Add New Project"**
3. Busca y selecciona el repositorio `english-lessons`
4. Antes de hacer deploy, haz clic en **"Environment Variables"** y agrega:
   - `VITE_SUPABASE_URL` → pega el Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` → pega la anon key de Supabase
5. Haz clic en **"Deploy"** y espera ~1 minuto
6. Vercel te dará una URL como `https://english-lessons-xxxx.vercel.app` ← **¡esa es tu app!**

---

### PASO 4 — Instalar como app en tu celular

**En Android (Chrome):**
1. Abre tu URL de Vercel en Chrome
2. Toca el menú (⋮) → **"Agregar a pantalla de inicio"**
3. Toca **"Agregar"** → ya aparece como app en tu pantalla

**En iPhone (Safari):**
1. Abre tu URL en Safari (importante: debe ser Safari)
2. Toca el botón de compartir (□↑) → **"Agregar a inicio"**
3. Toca **"Agregar"** → ya aparece como app en tu pantalla

---

## ✅ Listo

Tu app ya funciona en celular y computadora, los datos se sincronizan automáticamente entre dispositivos.
