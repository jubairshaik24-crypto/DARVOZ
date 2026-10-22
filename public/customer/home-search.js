(() => {
    const overlay = document.getElementById("darvozHomeSearch");
    const homeInput = document.getElementById("searchInput");
    const input = document.getElementById("dhSearchInput");
    const results = document.getElementById("dhSearchResults");
    const clearButton = document.getElementById("dhSearchClear");
    const backButton = document.getElementById("dhSearchBack");
    const cartBubble = document.getElementById("dhSearchCart");
    const cartCount = document.getElementById("dhSearchCartCount");
    if (!overlay || !homeInput || !input || !results) return;

    let timer = null;
    let requestController = null;

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);

    const imageUrl = (value) => {
        const url = String(value || "").trim();
        return /^https?:\/\//i.test(url) || url.startsWith("/") || url.startsWith("./")
            ? escapeHtml(url)
            : "";
    };

    const syncCartBubblePlacement = () => {
        if (!cartBubble) return;
        const activeOrderPopup = document.getElementById("activeOrderPopup");
        const orderIsVisible = activeOrderPopup && getComputedStyle(activeOrderPopup).display !== "none";
        if (orderIsVisible) {
            const orderRect = activeOrderPopup.getBoundingClientRect();
            cartBubble.classList.add("dh-search-cart-above-track");
            cartBubble.style.bottom = `${Math.max(0, window.innerHeight - orderRect.top + 10)}px`;
            cartBubble.style.right = `${Math.max(12, window.innerWidth - orderRect.right + 12)}px`;
        } else {
            cartBubble.classList.remove("dh-search-cart-above-track");
            cartBubble.style.bottom = "";
            cartBubble.style.right = "";
        }
    };
    const updateCartBubble = () => {
        if (!cartBubble || !cartCount) return;
        const customerId = localStorage.getItem("customerId");
        const cartKey = customerId ? `cart_${customerId}` : "cart";
        let cart = [];
        try {
            const saved = localStorage.getItem(cartKey) ?? localStorage.getItem("cart");
            cart = JSON.parse(saved || "[]");
        } catch (error) {
            cart = [];
        }
        const count = Array.isArray(cart)
            ? cart.reduce((total, item) => total + Math.max(0, Number(item.quantity || 1)), 0)
            : 0;
        cartCount.textContent = count > 99 ? "99+" : String(count);
        cartBubble.hidden = count === 0;
        cartBubble.setAttribute("aria-label", count ? `View cart with ${count} item${count === 1 ? "" : "s"}` : "View cart");
        syncCartBubblePlacement();
    };
    const showPopular = () => {
        results.innerHTML = `<div class="dh-search-caption">Popular searches</div>
            <div class="dh-search-chips">
                <button type="button" class="dh-search-chip">Biryani</button>
                <button type="button" class="dh-search-chip">Chicken</button>
                <button type="button" class="dh-search-chip">Pizza</button>
                <button type="button" class="dh-search-chip">Burger</button>
            </div>`;
    };

    const rowHtml = ({ name, meta, image, price, kind, restaurantId, productId, businessType, categoryId }) => {
        const safeImage = imageUrl(image);
        const imageHtml = safeImage
            ? `<img class="dh-search-thumb ${kind === "food" ? "dh-dish-thumb" : ""}" src="${safeImage}" alt="" onerror="this.style.visibility='hidden'">`
            : `<span class="dh-search-thumb ${kind === "food" ? "dh-dish-thumb" : ""}"></span>`;
        return `<button type="button" class="dh-search-row" data-kind="${kind}"
            data-restaurant-id="${Number(restaurantId) || ""}" data-product-id="${Number(productId) || ""}"
            data-business-type="${escapeHtml(businessType || "")}" data-category-id="${escapeHtml(categoryId || "")}">
            ${imageHtml}<span class="dh-search-copy"><span class="dh-search-name">${escapeHtml(name || "Product")}</span>
            <span class="dh-search-meta">${escapeHtml(meta || "")}</span>
            ${price == null ? "" : `<span class="dh-search-price">₹${Number(price || 0).toFixed(0)}</span>`}</span>
            <span class="dh-search-arrow">›</span></button>`;
    };

    const renderResults = (data, query) => {
        const groupedDishes = Array.isArray(data.restaurants)
            ? data.restaurants.flatMap((restaurant) => (Array.isArray(restaurant.items) ? restaurant.items : []).map((item) => ({
                ...item,
                restaurant: item.restaurant || {
                    restaurant_id: restaurant.restaurant_id || restaurant.id,
                    restaurant_name: restaurant.restaurant_name,
                    restaurant_image: restaurant.restaurant_image,
                    logo: restaurant.logo
                }
            })))
            : [];
        const dishes = Array.isArray(data.foodProducts) && data.foodProducts.length
            ? data.foodProducts
            : groupedDishes;
        const restaurants = Array.isArray(data.restaurantMatches) ? data.restaurantMatches : [];
        const groceries = Array.isArray(data.groceries) ? data.groceries : [];
        let html = "";

        if (dishes.length) {
            html += `<div class="dh-search-section-title">Dishes</div>`;
            html += dishes.slice(0, 30).map((item) => {
                const restaurant = item.restaurant || {};
                return rowHtml({
                    name: item.product_name,
                    meta: `Dish${restaurant.restaurant_name ? ` · ${restaurant.restaurant_name}` : ""}`,
                    image: item.image || restaurant.restaurant_image || restaurant.logo,
                    price: item.offer_price != null ? item.offer_price : item.price,
                    kind: "food",
                    restaurantId: restaurant.restaurant_id || item.partner_id,
                    productId: item.product_id || item.id,
                    businessType: item.business_type || item.businessType || ""
                });
            }).join("");
        }

        if (restaurants.length) {
            html += `<div class="dh-search-section-title">Restaurants</div>`;
            html += restaurants.slice(0, 10).map((item) => rowHtml({
                name: item.restaurant_name,
                meta: [item.rating ? `★ ${item.rating}` : "Restaurant", item.delivery_time ? `${item.delivery_time} min` : "", item.city || ""].filter(Boolean).join(" · "),
                image: item.logo || item.restaurant_image,
                kind: "restaurant",
                restaurantId: item.restaurant_id || item.id
            })).join("");
        }

        if (groceries.length) {
            html += `<div class="dh-search-section-title">Groceries</div>`;
            html += groceries.slice(0, 10).map((item) => rowHtml({
                name: item.product_name,
                meta: ["Grocery", item.size || ""].filter(Boolean).join(" · "),
                image: item.product_image || item.image,
                price: item.offer_price != null ? item.offer_price : item.price,
                kind: "grocery",
                restaurantId: item.partner_id,
                productId: item.product_id || item.id,
                businessType: item.business_type || item.businessType || "Grocery",
                categoryId: item.category_id || item.categoryId || ""
            })).join("");
        }

        results.innerHTML = html || `<div class="dh-search-state"><strong>No results for “${escapeHtml(query)}”</strong>Try another spelling or search for a dish or restaurant.</div>`;
    };

    const search = async (rawQuery) => {
        const query = String(rawQuery || "").trim();
        if (requestController) requestController.abort();
        if (query.length < 2) {
            results.innerHTML = `<div class="dh-search-state">Type at least 2 letters to see matching dishes and restaurants.</div>`;
            return;
        }

        const controller = new AbortController();
        requestController = controller;
        results.innerHTML = `<div class="dh-search-state">Searching Darvoz…</div>`;
        try {
            const response = await fetch(`${window.location.origin}/search?q=${encodeURIComponent(query)}`, {
                signal: controller.signal,
                headers: { "Accept": "application/json" }
            });
            if (!response.ok) throw new Error(`Search request failed (${response.status})`);
            const data = await response.json();
            if (controller.signal.aborted) return;
            if (!data || data.success !== true) throw new Error(data?.message || "Search failed");
            renderResults(data, query);
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error("DARVOZ HOME SEARCH ERROR", error);
            results.innerHTML = `<div class="dh-search-state"><strong>Search could not load</strong>Please try again in a moment.</div>`;
        }
    };

    const open = () => {
        updateCartBubble();
        overlay.classList.add("is-open");
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        showPopular();
        setTimeout(() => input.focus(), 40);
    };

    const close = () => {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        clearTimeout(timer);
        if (requestController) requestController.abort();
    };

    cartBubble?.addEventListener("click", () => {
        window.location.href = "cart.html";
    });
    window.addEventListener("storage", updateCartBubble);
    window.addEventListener("darvoz:cart-updated", updateCartBubble);
    const activeOrderPopup = document.getElementById("activeOrderPopup");
    if (activeOrderPopup && "MutationObserver" in window) {
        new MutationObserver(syncCartBubblePlacement).observe(activeOrderPopup, { attributes: true, attributeFilter: ["style"] });
    }
    window.addEventListener("resize", syncCartBubblePlacement);
    syncCartBubblePlacement();
    updateCartBubble();

    window.openDarvozHomeSearch = open;
    homeInput.addEventListener("click", open);
    homeInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") open();
    });
    backButton?.addEventListener("click", close);

    input.addEventListener("input", () => {
        const query = input.value.trim();
        clearButton.style.display = query ? "block" : "none";
        clearTimeout(timer);
        timer = setTimeout(() => search(query), 220);
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
        if (event.key === "Enter") {
            event.preventDefault();
            clearTimeout(timer);
            search(input.value);
        }
    });

    clearButton?.addEventListener("click", () => {
        input.value = "";
        clearButton.style.display = "none";
        showPopular();
        input.focus();
    });

    results.addEventListener("click", (event) => {
        const chip = event.target.closest(".dh-search-chip");
        if (chip) {
            input.value = chip.textContent.trim();
            clearButton.style.display = "block";
            search(input.value);
            return;
        }
        const row = event.target.closest(".dh-search-row");
        if (!row) return;
        const kind = row.dataset.kind;
        const restaurantId = Number(row.dataset.restaurantId);
        const productId = Number(row.dataset.productId);
        const businessType = row.dataset.businessType || "";
        const categoryId = row.dataset.categoryId || "";
        if (kind === "food" && restaurantId) {
            const params = new URLSearchParams({ id: String(restaurantId) });
            if (productId) params.set("product", String(productId));
            if (businessType) params.set("category", businessType);
            window.location.href = `restaurant.html?${params.toString()}`;
        } else if (kind === "restaurant" && restaurantId) {
            window.location.href = `restaurant.html?id=${encodeURIComponent(restaurantId)}`;
        } else if (kind === "grocery" && restaurantId) {
            const params = new URLSearchParams({ id: String(restaurantId) });
            if (productId) params.set("product", String(productId));
            if (businessType) params.set("category", businessType);
            if (categoryId) params.set("categoryId", categoryId);
            window.location.href = `restaurant.html?${params.toString()}`;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
    });
})();
