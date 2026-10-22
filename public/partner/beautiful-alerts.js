(() => {
    if (window.__darvozBeautifulAlertsInstalled) return;
    window.__darvozBeautifulAlertsInstalled = true;

    const queue = [];
    let visible = false;

    const style = document.createElement("style");
    style.textContent = `
        .darvoz-alert-overlay {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: grid;
            place-items: center;
            padding: 20px;
            background: rgba(15, 23, 42, .54);
            backdrop-filter: blur(4px);
            animation: darvozAlertFade .16s ease-out;
        }
        .darvoz-alert-card {
            position: relative;
            width: min(100%, 390px);
            padding: 30px 26px 24px;
            border: 1px solid rgba(255,255,255,.8);
            border-radius: 22px;
            background: #fff;
            box-shadow: 0 24px 70px rgba(15,23,42,.26);
            text-align: center;
            font-family: Inter, Poppins, system-ui, -apple-system, "Segoe UI", sans-serif;
            animation: darvozAlertRise .22s cubic-bezier(.2,.8,.2,1);
        }
        .darvoz-alert-close {
            position: absolute;
            top: 12px;
            right: 13px;
            width: 34px;
            height: 34px;
            border: 0;
            border-radius: 50%;
            background: #f4f5f7;
            color: #657080;
            font-size: 21px;
            cursor: pointer;
        }
        .darvoz-alert-mark {
            display: grid;
            place-items: center;
            width: 62px;
            height: 62px;
            margin: 0 auto 14px;
            border-radius: 20px;
            background: var(--darvoz-alert-soft);
            color: var(--darvoz-alert-color);
            font-size: 28px;
            font-weight: 800;
        }
        .darvoz-alert-brand {
            margin-bottom: 4px;
            color: #ff6b00;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.5px;
        }
        .darvoz-alert-title {
            margin: 0 0 8px;
            color: #172033;
            font-size: 20px;
            font-weight: 750;
        }
        .darvoz-alert-message {
            margin: 0 auto 22px;
            color: #5f6878;
            font-size: 14px;
            line-height: 1.6;
            overflow-wrap: anywhere;
        }
        .darvoz-alert-ok {
            width: 100%;
            min-height: 46px;
            border: 0;
            border-radius: 12px;
            background: linear-gradient(100deg, #ff5b00, #ff8200);
            color: #fff;
            font: inherit;
            font-size: 14px;
            font-weight: 750;
            cursor: pointer;
            box-shadow: 0 7px 17px rgba(255,107,0,.2);
        }
        .darvoz-alert-ok:focus-visible,
        .darvoz-alert-close:focus-visible {
            outline: 3px solid rgba(255,107,0,.35);
            outline-offset: 2px;
        }
        @keyframes darvozAlertFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes darvozAlertRise { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 420px) {
            .darvoz-alert-card { padding: 27px 20px 20px; border-radius: 19px; }
            .darvoz-alert-title { font-size: 18px; }
            .darvoz-alert-message { font-size: 13px; }
        }
        @media (prefers-reduced-motion: reduce) {
            .darvoz-alert-overlay, .darvoz-alert-card { animation: none; }
        }
    `;
    document.head.appendChild(style);

    function classify(message) {
        const text = message.toLowerCase();
        if (/successfully|saved|added|updated|completed|verified|sent successfully|removed|deleted|submitted/.test(text)) {
            return { title: "Success", mark: "✓", color: "#138a4b", soft: "#e8f8ef" };
        }
        if (/failed|unable|error|invalid|not found|couldn't|cannot|unavailable|denied|expired/.test(text)) {
            return { title: "Something went wrong", mark: "!", color: "#cf3c36", soft: "#fff0ef" };
        }
        if (/please|required|enter|choose|select|missing|must|empty/.test(text)) {
            return { title: "Please check", mark: "!", color: "#d47700", soft: "#fff5df" };
        }
        return { title: "Notice", mark: "i", color: "#2463d7", soft: "#edf4ff" };
    }

    function showNext() {
        if (visible || queue.length === 0) return;
        visible = true;

        const message = queue.shift();
        const kind = classify(message);
        const overlay = document.createElement("div");
        overlay.className = "darvoz-alert-overlay";
        overlay.style.setProperty("--darvoz-alert-color", kind.color);
        overlay.style.setProperty("--darvoz-alert-soft", kind.soft);

        const dialog = document.createElement("section");
        dialog.className = "darvoz-alert-card";
        dialog.setAttribute("role", "alertdialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "darvozAlertTitle");
        dialog.setAttribute("aria-describedby", "darvozAlertMessage");

        const close = document.createElement("button");
        close.className = "darvoz-alert-close";
        close.type = "button";
        close.setAttribute("aria-label", "Close");
        close.textContent = "×";

        const mark = document.createElement("div");
        mark.className = "darvoz-alert-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = kind.mark;

        const brand = document.createElement("div");
        brand.className = "darvoz-alert-brand";
        brand.textContent = "DARVOZ";

        const title = document.createElement("h2");
        title.className = "darvoz-alert-title";
        title.id = "darvozAlertTitle";
        title.textContent = kind.title;

        const body = document.createElement("p");
        body.className = "darvoz-alert-message";
        body.id = "darvozAlertMessage";
        body.textContent = message;

        const ok = document.createElement("button");
        ok.className = "darvoz-alert-ok";
        ok.type = "button";
        ok.textContent = "OK";

        const dismiss = () => {
            document.removeEventListener("keydown", onKeyDown);
            overlay.remove();
            visible = false;
            window.setTimeout(showNext, 80);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape" || event.key === "Enter") {
                event.preventDefault();
                dismiss();
            }
        };

        close.addEventListener("click", dismiss);
        ok.addEventListener("click", dismiss);
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) dismiss();
        });
        document.addEventListener("keydown", onKeyDown);

        dialog.append(close, mark, brand, title, body, ok);
        overlay.appendChild(dialog);
        (document.body || document.documentElement).appendChild(overlay);
        ok.focus();
    }

    window.alert = function(message) {
        queue.push(String(message ?? ""));
        showNext();
    };
})();
