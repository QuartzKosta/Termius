# ASHEN CODEX — D&D Campaign Console

Тёмно-фэнтезийная консоль кампании D&D «АШЕНОВ КОДЕКС» — интерактивный архив НПС, лора, правителей и государств с головоломками, голограммами и CRT-эстетикой.

## Установка

### 1. Клонирование и установка зависимостей
```bash
git clone https://github.com/QuartzKosta/Termius.git
cd Termius
bun install
```

После `bun install` автоматически запускается `postinstall: prisma generate` —
генерируется Prisma client с моделями из `schema.prisma`.

### 2. Настройка окружения
Создайте файл `.env` (скопируйте из `.env.example` и заполните своими значениями):
```bash
cp .env.example .env
```

Содержимое `.env`:
```env
DATABASE_URL=file:/абсолютный/путь/к/проекту/db/custom.db

VITE_SUPABASE_URL=https://ваш-проект.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_key
VITE_SUPABASE_SERVICE_KEY=ваш_service_role_key

ADMIN_PASSWORD=WARDEN
```

> **Важно:** `DATABASE_URL` должен содержать **абсолютный путь** к файлу БД
> (не относительный), иначе Prisma может не найти БД при запуске из другой директории.

### 3. Инициализация базы данных
```bash
bun run db:push
```
Это создаст SQLite-файл `db/custom.db` и все таблицы из `schema.prisma`
(User, Post, State, StateRelation).

### 4. Запуск
```bash
bun run dev
```
Сервер запустится на http://localhost:3000

## Структура

- `/` — публичная консоль (dnd-console.html) — архив, головоломки, голограммы
- `/admin` — админ-панель (пароль из `ADMIN_PASSWORD`, по умолчанию `WARDEN`)
  - NPC / LORE / RULERS — CRUD записей архива (Supabase)
  - ГОСУДАРСТВА — CRUD государств + отношений (Prisma/SQLite) + импорт из лора
  - WARDENS — управление стражами (игроками)
  - ПАНЕЛЬ СОБЫТИЙ — Час Ведьмы + Взгляд Бога

## Технологии

- **Next.js 16** + TypeScript 5 + Tailwind CSS 4
- **Prisma ORM** (SQLite) — для государств и отношений
- **Supabase** — для НПС, лора, правителей, стражей, достижений
- **shadcn/ui** + Lucide icons

## Troubleshooting

### «Prisma client не сгенерирован с моделью State/StateRelation»
Выполните:
```bash
bun run db:generate   # или: npx prisma generate
bun run db:push
```
Затем перезапустите dev server.

### «Cannot read properties of undefined (reading 'findMany')»
Та же проблема — Prisma client устарел. Решение выше.

### «can't reach database» / «no such table»
Проверьте `DATABASE_URL` в `.env` — должен быть абсолютный путь.
Затем выполните `bun run db:push`.

### Админ-панель: «сессия истекла»
Cookie живёт 7 дней. Если истекла — перезайдите через `/admin` с паролем из `ADMIN_PASSWORD`.
