#!/usr/bin/env bash
# ==============================================================================
# Zarfolio - Development Launcher (Frontend + Backend)
# ==============================================================================

# Ensure script resolves its own root directory regardless of invocation path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
cd "$ROOT_DIR" || exit 1

# Add bun to PATH if installed in user's home directory
if [ -d "$HOME/.bun/bin" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
fi

# If launched outside of an interactive terminal (e.g., double-clicked in file manager),
# automatically spawn a terminal emulator so the user can see live output.
if [ "$1" != "--in-terminal" ] && { [ ! -t 0 ] || [ ! -t 1 ]; }; then
    if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
        if command -v xfce4-terminal >/dev/null 2>&1; then
            exec xfce4-terminal --title="Zarfolio Development" --working-directory="$ROOT_DIR" -x "$BASH_SOURCE" --in-terminal "$@"
        elif command -v gnome-terminal >/dev/null 2>&1; then
            exec gnome-terminal --title="Zarfolio Development" --working-directory="$ROOT_DIR" -- "$BASH_SOURCE" --in-terminal "$@"
        elif command -v x-terminal-emulator >/dev/null 2>&1; then
            exec x-terminal-emulator -e "$BASH_SOURCE --in-terminal $*"
        elif command -v konsole >/dev/null 2>&1; then
            exec konsole --workdir "$ROOT_DIR" -e "$BASH_SOURCE" --in-terminal "$@"
        elif command -v kitty >/dev/null 2>&1; then
            exec kitty --directory "$ROOT_DIR" "$BASH_SOURCE" --in-terminal "$@"
        elif command -v alacritty >/dev/null 2>&1; then
            exec alacritty --working-directory "$ROOT_DIR" -e "$BASH_SOURCE" --in-terminal "$@"
        elif command -v xterm >/dev/null 2>&1; then
            exec xterm -title "Zarfolio Development" -e "$BASH_SOURCE" --in-terminal "$@"
        fi
    fi
fi

# Optional: Support opening separate tabs if requested via --tabs
if [ "$1" == "--tabs" ]; then
    if command -v xfce4-terminal >/dev/null 2>&1; then
        exec xfce4-terminal \
            --title="Zarfolio Dev" \
            --tab --title="Frontend (Next.js)" --working-directory="$ROOT_DIR/frontend" -x bash -c "export PATH=\"\$HOME/.bun/bin:\$PATH\"; echo -e '\033[1;32m[1/2] Starting Frontend (bun run dev)...\033[0m'; bun run dev; echo -e '\nFrontend stopped. Press Enter to close.'; read" \
            --tab --title="Backend (PocketBase)" --working-directory="$ROOT_DIR/backend" -x bash -c "chmod +x ./pocketbase 2>/dev/null; echo -e '\033[1;34m[2/2] Starting Backend (pocketbase serve)...\033[0m'; ./pocketbase serve; echo -e '\nBackend stopped. Press Enter to close.'; read"
    fi
fi

# Terminal header banner
echo -e "\033[1;36m============================================================\033[0m"
echo -e "\033[1;32m  🚀 اجرای محیط توسعه زرفولیو (Zarfolio Dev Server)\033[0m"
echo -e "\033[1;36m============================================================\033[0m"
echo -e "  🌐 فرانت‌اند (Next.js):     \033[1;34mhttp://localhost:3000\033[0m"
echo -e "  🗄️  بک‌اند (PocketBase):     \033[1;34mhttp://127.0.0.1:8090\033[0m"
echo -e "  🛠️  پنل ادمین (Dashboard): \033[1;34mhttp://127.0.0.1:8090/_/\033[0m"
echo -e "\033[1;36m------------------------------------------------------------\033[0m"
echo -e "\033[1;33m  برای بستن و متوقف کردن هر دو سرویس کلید Ctrl+C را بزنید.\033[0m"
echo -e "\033[1;36m============================================================\033[0m"
echo ""

# Pre-flight check: Bun
if ! command -v bun >/dev/null 2>&1; then
    echo -e "\033[1;31m[خطا] دستور bun یافت نشد!\033[0m"
    echo "لطفاً ابتدا Bun را نصب کنید یا اطمینان حاصل کنید در PATH سیستم قرار دارد."
    echo ""
    echo "Press Enter to exit..."
    read -r
    exit 1
fi

# Pre-flight check: PocketBase
if [ ! -f "$ROOT_DIR/backend/pocketbase" ]; then
    echo -e "\033[1;31m[خطا] فایل اجرایی pocketbase در مسیر backend/pocketbase یافت نشد!\033[0m"
    echo ""
    echo "Press Enter to exit..."
    read -r
    exit 1
fi

chmod +x "$ROOT_DIR/backend/pocketbase" 2>/dev/null

FRONTEND_PID=""
BACKEND_PID=""

# Graceful cleanup on exit or Ctrl+C
cleanup() {
    trap - INT TERM HUP EXIT
    echo ""
    echo -e "\033[1;33m[Zarfolio] در حال بستن سرویس‌ها...\033[0m"
    if [ -n "$FRONTEND_PID" ]; then
        kill -TERM "$FRONTEND_PID" 2>/dev/null
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill -TERM "$BACKEND_PID" 2>/dev/null
    fi
    sleep 0.5
    if [ -n "$FRONTEND_PID" ]; then
        kill -KILL "$FRONTEND_PID" 2>/dev/null
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill -KILL "$BACKEND_PID" 2>/dev/null
    fi
    wait "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null
    echo -e "\033[1;32m[Zarfolio] هر دو سرویس با موفقیت متوقف شدند.\033[0m"
    exit 0
}

trap cleanup INT TERM HUP EXIT

# 1. Start Frontend (bun run dev)
echo -e "\033[1;32m▶ [1/2] در حال اجرای فرانت‌اند (bun run dev)...\033[0m"
cd "$ROOT_DIR/frontend" || exit 1
bun run dev &
FRONTEND_PID=$!

# Brief pause to let frontend initialize first as requested
sleep 1.5

# 2. Start Backend (pocketbase serve)
echo -e "\033[1;34m▶ [2/2] در حال اجرای بک‌اند (pocketbase serve)...\033[0m"
cd "$ROOT_DIR/backend" || exit 1
./pocketbase serve &
BACKEND_PID=$!

# Return to root
cd "$ROOT_DIR" || exit 1

# Wait for background jobs to finish
wait
