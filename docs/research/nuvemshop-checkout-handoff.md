# Nuvemshop/Tiendanube: External Cart → Hosted Checkout Handoff

**Research date:** 2026-09-14
**Researcher:** Claude (background research agent), on behalf of fernando.m.erthal@gmail.com
**Scope:** Can a 100%-custom, externally-hosted shopping cart (Angular SPA) hand off to Nuvemshop's hosted checkout with the correct product/variant/quantity already loaded, using ONLY official Nuvemshop/Tiendanube documentation as evidence?

**Confirmed prior context (not re-verified here):**
- The Cart API (`/carts`) is read/delete only — no create/populate-from-scratch endpoint.
- Payment always executes on Nuvemshop's own domain/infrastructure (PCI compliance).
- There is no standalone/isolated shipping-cost-calculation API endpoint.

**Sources consulted (official only):**
- `tiendanube.github.io/api-documentation` — developer/API documentation (REST API reference)
- `tiendanube.github.io/devhub-apps` — developer/API documentation (Apps/Devhub platform docs)
- `dev.nuvemshop.com.br` — developer/API documentation (PT-BR mirror of the Devhub portal)
- `docs.nuvemshop.com.br` — **theme/web-designer documentation** (how Nuvemshop's own Liquid/Twig-based storefront theme is built and customized — technical, but about themes, not the REST API)
- `atendimento.nuvemshop.com.br` — **merchant help-center documentation (non-technical)**, explicitly labeled as such below wherever cited

---

## Question 1 — Deep link / buy button: documented public URL scheme to add a specific item + go straight to checkout?

**Answer:** Partially yes, but it is a **merchant help-center feature, not a documented API/query-parameter mechanism**, and by the platform's own description it does **not**, by itself, land the customer on checkout with the item pre-added — it lands them on the **cart page**. A separate "Comprar agora" (Buy Now) button is described as creating a new cart and going straight to checkout, but no technical/URL specification for it was found.

- **Source:** [Como compartilhar o link do carrinho direto de um produto da minha loja Nuvemshop?](https://atendimento.nuvemshop.com.br/pt_BR/vendas/como-compartilhar-o-link-do-carrinho-direto-de-um-produto-da-minha-loja-nuvemshop) — **merchant help-center documentation (non-technical)**.
- **Documented URL pattern (as written on the page):** `https://{{url_loja}}/comprar/(idVariante)-(quantidade)/`
  Example: a link ending in `/comprar/123456` adds 1 unit of variant `123456`; `/comprar/123456-3` adds 3 units. The quantity segment is optional (defaults to 1) and can be edited after landing.
- **Quote/paraphrase:** "Depois de clicar, o cliente permanece na página do carrinho e pode ajustar as quantidades antes de finalizar a compra." (After clicking, the customer stays on the cart page and can adjust quantities before completing the purchase.) The same article distinguishes this from the "Comprar agora" button: that button "cria um carrinho novo e leva o cliente direto ao checkout" (creates a new cart and takes the customer directly to checkout), whereas the cart link preserves the existing cart and stops at the cart page, not checkout.
- **Important caveats:**
  - This is generated **from inside the Nuvemshop admin panel** ("Compartilhar link do carrinho"), for a product that already exists in the store — it is not documented as an API you construct arbitrarily from an external system, though the URL pattern itself is simple enough to construct programmatically if the `idVariante` is known.
  - No dedicated developer/API documentation page (in `tiendanube.github.io/api-documentation` or `devhub-apps`) documents this `/comprar/` route, its query-parameter contract, error behavior, or guarantees of stability. It was found only in the merchant help center.
  - The "Comprar agora" (skip cart, go straight to checkout) behavior is described only in the same non-technical help-center context; no exact URL syntax for it was located in any official source (technical or help-center) during this research.
  - **Gap — explicitly flagged:** No official documentation (technical or help-center) was found that confirms this `/comprar/` link works for **multiple line items at once** (i.e., a whole cart with several products/variants/quantities in a single URL). The documented example is single-variant only. Do not assume multi-item support.

---

## Question 2 — Catalog requirement: must the product/variant already exist in Nuvemshop's catalog?

**Answer:** Yes — every piece of official documentation examined assumes and requires that the product/variant already exists in Nuvemshop's own catalog. No evidence of "ad-hoc" line items defined purely from outside data (with no corresponding catalog record) was found anywhere in the checkout, cart, or order documentation.

- **Sources:**
  - [Cart resource](https://tiendanube.github.io/api-documentation/resources/cart) — **developer/API documentation**. The Cart API only exposes reading an existing cart and removing a line item/coupon by ID from it — it never accepts arbitrary, non-catalog item data.
  - [Direct cart link help article](https://atendimento.nuvemshop.com.br/pt_BR/vendas/como-compartilhar-o-link-do-carrinho-direto-de-um-produto-da-minha-loja-nuvemshop) — **merchant help-center documentation (non-technical)**. The `/comprar/(idVariante)-(quantidade)/` link is built around a `idVariante` — a variant ID that must already exist in the store's catalog (the merchant "encontra o produto ... e copia o link correspondente" — finds the product and copies its link from the admin panel).
  - [Order resource](https://tiendanube.github.io/api-documentation/resources/order) — **developer/API documentation**. Even when creating an Order directly via the API (see Q5), the required `products` field is a list referencing catalog products, not free-form/ad-hoc line items with arbitrary descriptions and prices.
- **Quote/paraphrase:** The Cart resource doc states a Cart "generated in a storefront" can only be read or have existing line items/coupons removed — there is no mechanism to inject a line item that doesn't already correspond to a real catalog product/variant. The buy-link mechanism is explicitly variant-ID-based, confirming the same constraint at the storefront-URL level.
- **Conclusion:** No documented "ad-hoc checkout" path exists. The product must be pre-registered in Nuvemshop's catalog.

---

## Question 3 — Product API for catalog sync (create/update products, price, stock, variants)?

**Answer:** Yes — there is a documented, full-featured Product API that could be used to keep Nuvemshop's catalog synced from an external source of truth.

- **Source:** [Product resource](https://tiendanube.github.io/api-documentation/resources/product) — **developer/API documentation**.
- **Endpoints found:**
  - `POST /products` — "Creates a new Product." Accepts variant objects with pricing/stock at creation time.
  - `PUT /products/{id}` — "Modify an existing Product." Note the documented caveat: for a product without explicit variants, price/stock changes "must be made on its 'virtual' variant, not on the product itself."
  - `PATCH /products/stock-price` — Bulk endpoint: "Updates Stock or Price of multiple products and variants. 50 different variants can be updated at once taking all products into account."
  - Variant objects support fields including `price`, `stock_management`, `stock`, `weight`, `cost`.
  - Products support "up to 1,000 total variants combined across the three attributes" (documented variant limit).
- **Additional note surfaced during research:** the docs mention "a new Product API with support for multi inventory is currently being rolled out," and recommend using the new version for new development — this was noted but not deeply explored; worth a follow-up read of the multi-inventory migration guides (`tiendanube.github.io/api-documentation/guides/multi-inventory/...`) before implementation, since it may change the exact endpoint shapes above.
- **Conclusion:** A documented Product API exists and is capable of the create/update/price/stock/variant operations needed for one-way catalog sync from an external source of truth into Nuvemshop.

---

## Question 4 — Intended usage model: does Nuvemshop assume the whole store lives on their platform, or does it anticipate a 100% external storefront using Nuvemshop only for checkout?

**Answer:** The documentation's model assumes the **whole customer-facing store** (navigation, homepage, product listing, product detail, cart, and at least some checkout presentation) is built and hosted using **Nuvemshop's own theme system**. No official documentation describes, anticipates, or supports a pattern where the entire storefront is built externally and Nuvemshop is used **only** for the final checkout step.

- **Source A:** [Documentação para Web Designers — Funcionalidades](https://docs.nuvemshop.com.br/help/funcionalidades) — **developer/technical documentation, but for theme building, not the REST API**. This is a template-based theme system (`.tpl` template files, reusable "snippets," Twig-family templating) that documents, as first-class sections of one theme: "Navegação" (Navigation), "Página de inicio" (Homepage), "Lista de produtos" (Product listing), "Detalhe do produto" (Product detail), and "Carrinho de compras" (Shopping cart) — plus a tutorial on customizing checkout CSS ("Como aplicar CSS no checkout"). All of these are documented as parts of the same Nuvemshop-hosted theme.
- **Source B:** [Documentação para Web Designers — Carrinho de compras](https://docs.nuvemshop.com.br/help/carrinho-de-compras) — same documentation set; describes cart customization (e.g., `coupon-input`, "resumo do carrinho") as part of the store's own theme templates, i.e., the cart is a themed page on Nuvemshop's platform, not an external component.
- **Source C:** [DevHub — Applications Overview](https://tiendanube.github.io/devhub-apps/en/docs/applications/overview/) and [DevHub — External/Standalone Applications](https://tiendanube.github.io/devhub-apps/en/docs/applications/standalone/) — **developer/API documentation**. Apps come in two flavors: "Integrated" (run inside an iframe in the Merchant Admin dashboard) and "External/Standalone" ("independent solutions that load outside of the Merchant's Admin. They operate autonomously and can cover a wide range of functionalities, from marketing to inventory management"). Both categories are about **extending/administering the store** (marketing tools, inventory management, admin-panel features) — neither is described as a way to build or replace the customer-facing storefront (catalog browsing, cart) with an entirely external site. No mention of "headless," a "storefront API," or any officially sanctioned fully-external storefront pattern was found anywhere in DevHub docs.
- **Source D:** [O que é a API da Nuvemshop?](https://atendimento.nuvemshop.com.br/pt_BR/12316-api/o-que-e-a-api-da-nuvemshop-e-o-que-e-possivel-integrar-por-meio-dela) — **merchant help-center documentation (non-technical)**. Describes the API's purpose as integrating/synchronizing with the existing Nuvemshop store (products, orders, customers, coupons) — it does not describe or mention building an independent storefront outside Nuvemshop. Carts and checkout are notably absent from its list of things the API exposes.
- **Conclusion:** Every official source that speaks to platform architecture treats the theme (catalog + cart + at least the checkout's visual layer) as living on Nuvemshop's own platform. "External apps" are an admin/backend extension mechanism, not a storefront-replacement mechanism. **No official documentation describes, anticipates, or explicitly supports the 100%-external-storefront-with-Nuvemshop-only-for-checkout pattern the project is considering.** This doesn't mean it's technically impossible (the buy-link mechanism in Q1 does provide a real, if narrow, technical bridge), but it is not a documented/sanctioned architecture — it would be an unsupported/undocumented use of a merchant-facing convenience feature.

---

## Question 5 — Ad-hoc checkout session / payment link from an externally-created order?

**Answer:** No. Orders can be created via the API, but nothing in the official documentation shows the Order-creation response (or any related endpoint) returning a checkout/payment URL for that order. The one resource that does carry a checkout URL field — Abandoned Checkout — is **read-only and system-generated**; it cannot be created on demand from an externally-built order.

- **Source A:** [Order resource](https://tiendanube.github.io/api-documentation/resources/order) — **developer/API documentation**. Confirms "Orders also can be created through the API" via `POST /orders`, requiring fields such as `gateway`, `products`, `customer`, `billing_address`, `shipping_address`, `shipping_pickup_type`, `shipping`, `shipping_option`, `shipping_cost_customer` (with several optional fields like `payment_status`, `status`, `total`, etc.). **No checkout/payment URL field is documented anywhere in the Order resource's response or fields.**
- **Source B:** [Abandoned Checkout resource](https://tiendanube.github.io/api-documentation/resources/abandoned-checkout) — **developer/API documentation**. This resource does carry a relevant field, `abandoned_checkout_url` — documented as "Redirect URL for checkout." However:
  - Endpoints are `GET /checkouts`, `GET /checkouts/{checkout_id}`, and `POST /checkouts/{cart_id}/coupon` (adds a coupon to an existing abandoned checkout) — **there is no `POST /checkouts` to create one from scratch.**
  - Quote/paraphrase: "The abandoned checkout is created when the customer reaches checkout's second step, but for some reason it does not finish the process." Creation is explicitly system-driven (triggered by real customer behavior in Nuvemshop's own checkout flow), not something an external system can invoke on demand for an arbitrary order.
- **Source C:** [Checkout resource](https://tiendanube.github.io/api-documentation/resources/checkout) — **developer/API documentation**. This resource is unrelated to "checkout session" creation — it documents how **Payment Provider apps** integrate into Nuvemshop's existing checkout (External Payment / Modal Payment / Transparent Payment integration types, the `checkout_js_url` mechanism, `Checkout.getData()`, `Checkout.processPayment()`). It presumes a checkout is already underway on Nuvemshop's platform; it does not expose a way to spin up a checkout/payment URL from an externally assembled order.
- **Conclusion:** No Stripe-Checkout-Session-like or Mercado-Pago-payment-link-like mechanism is documented. The closest thing (`abandoned_checkout_url`) is a read-only side effect of real abandonment inside Nuvemshop's own checkout flow, not a creatable resource.

---

## Final Verdict

The official documentation supports **"products pre-registered in Nuvemshop's catalog, with the cart/checkout assembled through Nuvemshop's own mechanisms,"** not "100% external cart with arbitrary correct-item handoff into Nuvemshop's hosted checkout." Every mechanism found (the Cart API, the `/comprar/(idVariante)-(quantidade)/` link, Order creation, Abandoned Checkout) requires the product/variant to already exist in Nuvemshop's catalog, and the Product API (Q3) is exactly the tool to keep that catalog synced from an external source of truth. The one genuinely useful bridge for the stated goal is the merchant-help-center-documented `/comprar/(idVariante)-(quantidade)/` link (Q1) — but it is undocumented at the API level, is only confirmed for a **single item** per link, and by the platform's own description lands the customer on the **cart page**, not checkout (a separate, still-undocumented "Comprar agora" behavior is described as going straight to checkout, with no confirmed URL contract for it). Architecturally, DevHub's app model (Integrated vs. External apps) and the theme documentation both frame Nuvemshop as expecting catalog + cart + checkout to live on its own platform; "external apps" are an admin/backend extension pattern, not a storefront-replacement pattern. No Stripe-Checkout-Session-equivalent exists for turning an API-created order into a payment link.

**Practical implication for the architecture question:** the Angular SPA cart would need to (a) keep Nuvemshop's catalog in sync via the Product API so every sellable item has a stable `variant_id`, and (b) at handoff time, either construct the single-item `/comprar/(idVariante)-(quantidade)/` link per item (unconfirmed for multi-item carts, and undocumented as a stable API contract) or fall back to some other officially-supported mechanism not identified in this research (e.g., re-adding items client-side against Nuvemshop's own storefront cart JS before redirecting) — this remains an open engineering risk, not a documented, guaranteed capability.

---

## Explicit gaps / low-confidence areas (do not assume beyond what is stated)

1. **Multi-item support for the `/comprar/` link is unconfirmed.** Only a single-variant example is documented. Whether multiple items can be combined in one link/request is **not found in official documentation — do not assume either way.**
2. **No exact URL/technical contract for the "Comprar agora" (skip-cart, straight-to-checkout) button was located**, only a behavioral description in a merchant help-center article. Its query-parameter format, stability guarantees, and whether it's usable from an external, non-Nuvemshop-hosted page were **not found in official documentation.**
3. **Whether the `/comprar/` link (or any documented mechanism) is officially sanctioned for programmatic/automated construction from an external application** (as opposed to manual copy-paste by a merchant from the admin panel) is **not stated either way** in any source reviewed.
4. The **new multi-inventory Product API** (mentioned in passing in the Product resource docs) was not explored in depth; its endpoint shapes may differ from the classic ones cited in Q3 and should be re-checked against `tiendanube.github.io/api-documentation/guides/multi-inventory/...` before implementation.
