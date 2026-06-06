const API = "";

let poLines = [];
let poProductsCache = [];
let token = "";
let currentRole = "";
let cart = [];
let branchesCache = [];
let salesProfitChart = null;
let stockChart = null;
let html5QrCode = null;
let systemCurrency = "USD";
let usdToLbpRate = 89500;

function authHeaders(extra = {}) {
    const savedToken = localStorage.getItem("token") || token || "";
    return {
        ...extra,
        "Authorization": "Bearer " + savedToken
    };
}

async function fetchJson(url, options = {}) {
    const res = await fetch(API + url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function money(value) {
    return Number(value || 0).toFixed(2);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function safeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[c]));
}

// CURRENCY HELPERS
window.loadSystemCurrency = async function () {
    try {
        const res = await fetch(API + "/currency-settings");
        const settings = await res.json();

        systemCurrency = settings.default_currency || "USD";
        usdToLbpRate = Number(settings.usd_to_lbp_rate || 89500);
    } catch (err) {
        console.error("Currency settings load failed:", err);
        systemCurrency = "USD";
        usdToLbpRate = 89500;
    }
};

window.formatMoney = function (amount) {
    const value = Number(amount || 0);

    if (systemCurrency === "LBP") {
        return Math.round(value * usdToLbpRate).toLocaleString() + " L.L.";
    }

    return "$" + value.toFixed(2);
};

// Safety alias for old lowercase calls
window.formatmoney = function (amount) {
    return window.formatMoney(amount);
};

// ROLE PERMISSIONS
window.applyRolePermissions = function () {
    const role = currentRole || localStorage.getItem("role");

    const allButtons = [
        "dashboardMenuBtn",
        "branchDashboardMenuBtn",
        "productsMenuBtn",
        "posMenuBtn",
        "receivingMenuBtn",
        "reportsMenuBtn",
        "customersMenuBtn",
        "customerReturnsMenuBtn",
        "expensesMenuBtn",
        "closingMenuBtn",
        "invoiceReportMenuBtn",
        "branchesMenuBtn",
        "stockControlMenuBtn",
        "suppliersMenuBtn",
        "currencyMenuBtn",
        "usersMenuBtn"
    ];

    const permissions = {
        admin: allButtons,

        cashier: [
            "posMenuBtn",
            "customersMenuBtn"
        ],

        warehouse: [
            "productsMenuBtn",
            "receivingMenuBtn",
            "branchesMenuBtn",
            "stockControlMenuBtn",
            "suppliersMenuBtn"
        ],

        manager: [
            "dashboardMenuBtn",
            "branchDashboardMenuBtn",
            "reportsMenuBtn",
            "customersMenuBtn",
            "customerReturnsMenuBtn",
            "expensesMenuBtn",
            "closingMenuBtn",
            "invoiceReportMenuBtn",
            "stockControlMenuBtn"
        ]
    };

    allButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = "none";
    });

    (permissions[role] || []).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = "block";
    });
};

// AUTH
window.login = async function () {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        alert("Please enter username and password");
        return;
    }

    try {
        if (typeof window.loadSystemCurrency === "function") {
            await window.loadSystemCurrency();
        }

        const res = await fetch(API + "/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        token = data.token;
        currentRole = data.role;

        localStorage.setItem("token", token);
        localStorage.setItem("role", currentRole);
        localStorage.setItem("username", username);

        if (typeof window.applyRolePermissions === "function") {
            window.applyRolePermissions();
        }

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        const adminSection = document.getElementById("adminSection");
        if (adminSection) {
            adminSection.style.display = currentRole === "admin" ? "block" : "none";
        }

        const usersMenuBtn = document.getElementById("usersMenuBtn");
        if (usersMenuBtn) {
            usersMenuBtn.style.display = currentRole === "admin" ? "block" : "none";
        }

        if (currentRole === "cashier") {
            showPage("posPage");
        } else if (currentRole === "warehouse") {
            showPage("productsPage");
        } else {
            showPage("dashboardPage");
        }

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        alert("Login failed: " + err.message);
    }
};

window.logout = function () {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");

    token = "";
    currentRole = "";
    cart = [];

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    document.getElementById("mainSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
};

// NAVIGATION
window.showPage = function (pageId) {
    const role = currentRole || localStorage.getItem("role");

    const pagePermissions = {
        dashboardPage: ["admin", "manager"],
        branchDashboardPage: ["admin", "manager"],
        productsPage: ["admin", "warehouse"],
        posPage: ["admin", "cashier"],
        receivingPage: ["admin", "warehouse"],
        reportsPage: ["admin", "manager"],
        invoiceReportPage: ["admin", "manager"],
        customersPage: ["admin", "cashier", "manager"],
        customerReturnsPage: ["admin", "manager"],
        expensesPage: ["admin", "manager"],
        closingPage: ["admin", "manager"],
        branchesPage: ["admin", "warehouse"],
        stockControlPage: ["admin", "warehouse", "manager"],
        suppliersPage: ["admin", "warehouse"],
        currencyPage: ["admin"],
        usersPage: ["admin"]
    };

    if (pagePermissions[pageId] && !pagePermissions[pageId].includes(role)) {
        alert("Access denied for your role");
        return;
    }

    document.querySelectorAll(".page").forEach(page => {
        page.style.display = "none";
    });

    const page = document.getElementById(pageId);

    if (!page) {
        alert("Page not found: " + pageId);
        return;
    }

    page.style.display = "block";

    if (pageId === "dashboardPage") {
        loadDashboard();
        loadCharts();
    }

    if (pageId === "branchDashboardPage") {
        loadBranchDashboard();
    }

    if (pageId === "productsPage") {
        loadProducts();
    }

    if (pageId === "customersPage") {
        loadCustomers();
        loadHistoryCustomerOptions();
    }

    if (pageId === "customerReturnsPage") {
        loadCustomerReturnOptions();
        loadCustomerReturns();
    }

    if (pageId === "expensesPage") {
        loadExpenses();
    }

    if (pageId === "closingPage") {
        const input = document.getElementById("closingDateInput");
        if (input && !input.value) {
            input.value = new Date().toISOString().slice(0, 10);
        }
        const transferDate = document.getElementById("profitTransferDate");
    if (transferDate && !transferDate.value) {
        transferDate.value = new Date().toISOString().slice(0, 10);
    }

    loadDailyClosing();
    loadProfitTransfers();
    }

    if (pageId === "currencyPage") {
        loadCurrencySettings();
    }

    if (pageId === "posPage") {
        loadSaleBranchOptions();
        loadSaleCustomerOptions();
        setText("availableBranchStock", "0");

        setTimeout(() => {
            const barcode = document.getElementById("posBarcode");
            if (barcode) barcode.focus();
        }, 100);
    }

    if (pageId === "invoiceReportPage") {
        loadInvoices();
    }

    if (pageId === "receivingPage") {
        setTimeout(() => {
            const receiveBarcode = document.getElementById("receiveBarcode");
            if (receiveBarcode) receiveBarcode.focus();
        }, 100);
    }

    if (pageId === "suppliersPage") {
        loadSupplierOptions();
        loadPurchaseOrders();
        loadHistorySupplierOptions();
        loadSupplierReturnOptions();
        loadSupplierReturns();
        loadPurchaseControlOptions();
        loadSupplierBalanceReport();
        loadSuppliersList();
        setTimeout(() => {
    const poSearchInput = document.getElementById("poSearchInput");
    const poStatusFilter = document.getElementById("poStatusFilter");

    if (poSearchInput && !poSearchInput.dataset.listenerAdded) {
        poSearchInput.addEventListener("input", loadPurchaseOrders);
        poSearchInput.dataset.listenerAdded = "true";
    }

    if (poStatusFilter && !poStatusFilter.dataset.listenerAdded) {
        poStatusFilter.addEventListener("change", loadPurchaseOrders);
        poStatusFilter.dataset.listenerAdded = "true";
    }
}, 300);
    }

    if (pageId === "branchesPage") {
        loadBranches();
        loadBranchStockOptions();
        loadBranchStock();
        loadTransferOptions();
        loadStockTransfers();
    }

    if (pageId === "stockControlPage") {
        loadStockControlOptions();
        loadStockAdjustments();
        loadStockAdjustmentReportOptions();
        loadStockAdjustmentReport();
        loadMinStockOptions();
        loadLowStockBranchReport();
        loadReorderOptions();
        loadReorderSuggestions();
        loadStockAuditReport();
    }

    if (pageId === "usersPage") {
        loadUsers();
    }
};

// USERS
window.createUser = async function () {
    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value.trim();
    const role = document.getElementById("newRole").value;

    if (!username || !password || !role) {
        alert("Please enter username, password, and role");
        return;
    }

    const res = await fetch(API + "/create-user", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ username, password, role })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("newUsername").value = "";
    document.getElementById("newPassword").value = "";

    loadUsers();
};

window.loadUsers = async function () {
    try {
        const users = await fetchJson("/users", {
            headers: authHeaders()
        });

        const table = document.getElementById("usersTable");
        if (!table) return;

        table.innerHTML = "";

        users.forEach(u => {
            table.innerHTML += `
                <tr>
                    <td>${u.id}</td>
                    <td>${safeHtml(u.username)}</td>
                    <td>${safeHtml(u.role)}</td>
                    <td><button onclick="changeUserPassword(${u.id})">Change Password</button></td>
                    <td><button onclick="deleteUser(${u.id})">Delete</button></td>
                </tr>
            `;
        });
    } catch (err) {
        alert(err.message);
    }
};

window.changeUserPassword = async function (id) {
    const password = prompt("Enter new password:");
    if (!password) return;

    try {
        const data = await fetchJson("/users/" + id + "/password", {
            method: "PUT",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ password })
        });

        alert(data.message || "Password updated");
    } catch (err) {
        alert(err.message);
    }
};

window.deleteUser = async function (id) {
    if (!confirm("Delete this user?")) return;

    try {
        const data = await fetchJson("/users/" + id, {
            method: "DELETE",
            headers: authHeaders()
        });

        alert(data.message || "User deleted");
        loadUsers();
    } catch (err) {
        alert(err.message);
    }
};

// DASHBOARDS
window.loadDashboard = async function () {
    try {
        const data = await fetchJson("/dashboard");

        setText("totalProducts", data.totalProducts ?? data.total_products ?? 0);
        setText("totalStock", data.totalStock ?? data.total_stock ?? 0);
        setText("totalSales", formatMoney(data.total_sales || data.totalSales || 0));
        setText("lowStock", data.lowStock ?? data.low_stock ?? 0);
        setText("totalProfit", formatMoney(data.total_profit || data.totalProfit || 0));
    } catch (err) {
        console.error("Dashboard error:", err);
    }
};

window.loadBranchDashboard = async function () {
    try {
        const data = await fetchJson("/branch-dashboard");

        const salesTable = document.getElementById("branchSalesDashboardTable");
        const stockTable = document.getElementById("branchStockDashboardTable");

        if (!salesTable || !stockTable) return;

        salesTable.innerHTML = "";
        stockTable.innerHTML = "";

        data.sales.forEach(row => {
            salesTable.innerHTML += `
                <tr>
                    <td>${safeHtml(row.branch_name)}</td>
                    <td>${formatMoney(row.total_sales || 0)}</td>
                    <td>${formatMoney(row.total_profit || 0)}</td>
                </tr>
            `;
        });

        data.stock.forEach(row => {
            const low = data.lowStock.find(x => Number(x.branch_id) === Number(row.branch_id));
            stockTable.innerHTML += `
                <tr>
                    <td>${safeHtml(row.branch_name)}</td>
                    <td>${row.total_stock}</td>
                    <td>${low ? low.low_stock_items : 0}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Branch dashboard error:", err);
        alert("Branch dashboard failed: " + err.message);
    }
};

// PRODUCTS
window.loadBranchesCache = async function () {
    branchesCache = await fetchJson("/branches");
};

window.loadProducts = async function () {
    try {
        await loadBranchesCache();
        const products = await fetchJson("/products");
        displayProducts(products);
    } catch (err) {
        console.error("LOAD PRODUCTS ERROR:", err);
        alert(err.message || "Failed to load products");
    }
};

window.displayProducts = function (products) {
    const table = document.getElementById("productTable");
    if (!table) return;

    table.innerHTML = "";

    products.forEach(p => {
        const branchOptions = branchesCache.map(b => `<option value="${b.id}">${safeHtml(b.name)}</option>`).join("");

        table.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td>
                    ${safeHtml(p.name)}
                    ${
                        currentRole === "admin"
                     ? `<br><button onclick="editProductName(${p.id}, '${String(p.name).replace(/'/g, "\\'")}')">Edit Name</button>`
                     : ""
                    }
                </td>
                <td>${safeHtml(p.barcode)}</td>
                <td>
                    ${safeHtml(p.uom || "PCS")}
                    ${
                        currentRole === "admin"
                        ? `<br><button onclick="editProductUOM(${p.id}, '${String(p.uom || "PCS").replace(/'/g, "\\'")}')">Edit UOM</button>`
        : ""
                    }
</td>
                <td>${formatMoney(p.price)}</td>
                <td>${p.stock}</td>
                <td>
                    <select id="branch_${p.id}">
                        ${branchOptions}
                    </select>
                </td>
                <td>
                    <input id="branch_qty_${p.id}" type="number" min="1" placeholder="Qty" style="width:80px;">
                </td>
                <td><button onclick="receiveToBranch(${p.id})">Receive Branch</button></td>
                <td><button disabled title="Use Receive Branch instead">+</button></td>
                <td><button disabled title="Use POS page for branch sales">-</button></td>
                <td>${currentRole === "admin" ? `<button onclick="deleteProduct(${p.id})">Delete</button>` : ""}</td>
            </tr>
        `;
    });
};

window.editProductName = async function (id, oldName) {
    const newName = prompt("Enter new product name:", oldName);

    if (newName === null) return;

    if (!newName.trim()) {
        alert("Product name cannot be empty");
        return;
    }

    if (newName.trim() === oldName) {
        return;
    }

    const res = await fetch(API + "/products/" + id + "/name", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            name: newName.trim()
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadProducts();

    if (typeof loadDashboard === "function") {
        loadDashboard();
    }
};

window.addProduct = async function () {
    const name = document.getElementById("pname").value.trim();
    const barcode = document.getElementById("barcode").value.trim();
    const price = Number(document.getElementById("price").value);
    const cost = Number(document.getElementById("cost").value);
    const uomInput = document.getElementById("uom");
    const uom = uomInput ? uomInput.value : "PCS";

    if (!name || !barcode || price <= 0) {
        alert("Please enter product name, barcode, and valid price");
        return;
    }

    try {
        const data = await fetchJson("/products", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ name, barcode, price, cost, uom })
        });

        alert(data.message || "Product added");

        document.getElementById("pname").value = "";
        document.getElementById("barcode").value = "";
        document.getElementById("price").value = "";
        document.getElementById("cost").value = "";
       const uomClear = document.getElementById("uom");
        if (uomClear) uomClear.value = "PCS";

        loadProducts();
        loadDashboard();
    } catch (err) {
        alert(err.message);
    }
};

window.editProductUOM = async function (id, oldUOM) {
    const allowedUOMs = [
        "PCS",
        "BOX",
        "PACK",
        "KG",
        "GRAM",
        "LITER",
        "ML",
        "BOTTLE",
        "CARTON",
        "DOZEN",
        "CASE",
        "TRAY",
        "ROLL",
        "CAN",
        "JAR",
        "BAG"
    ];

    const newUOM = prompt(
        "Enter new UOM:\n\nAllowed: " + allowedUOMs.join(", "),
        oldUOM || "PCS"
    );

    if (newUOM === null) return;

    const cleanUOM = newUOM.trim().toUpperCase();

    if (!cleanUOM) {
        alert("UOM cannot be empty");
        return;
    }

    if (!allowedUOMs.includes(cleanUOM)) {
        alert("Invalid UOM. Allowed values are:\n" + allowedUOMs.join(", "));
        return;
    }

    if (cleanUOM === oldUOM) {
        return;
    }

    const res = await fetch(API + "/products/" + id + "/uom", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            uom: cleanUOM
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadProducts();

    if (typeof loadSupplierOptions === "function") {
        loadSupplierOptions();
    }

    if (typeof loadPurchaseOrders === "function") {
        loadPurchaseOrders();
    }

    if (typeof loadBranchStock === "function") {
        loadBranchStock();
    }
};

window.searchProduct = window.searchByBarcode = async function () {
    const barcodeInput = document.getElementById("barcodeSearchInput") || document.getElementById("searchBarcode");
    const barcode = barcodeInput ? barcodeInput.value.trim() : "";

    if (!barcode) {
        alert("Please enter or scan barcode");
        return;
    }

    try {
        const products = await fetchJson("/products");
        const filtered = products.filter(p => String(p.barcode) === barcode);

        if (filtered.length === 0) {
            alert("Product not found");
            return;
        }

        displayProducts(filtered);
    } catch (err) {
        alert(err.message);
    }
};

window.deleteProduct = async function (id) {
    if (!confirm("Delete this product and related transactions?")) return;

    try {
        const data = await fetchJson("/products/" + id, {
            method: "DELETE",
            headers: authHeaders()
        });

        alert(data.message || "Product deleted");
        loadProducts();
        loadDashboard();

        if (typeof loadBranchStock === "function") {
            loadBranchStock();
        }
    } catch (err) {
        alert(err.message);
    }
};

window.receiveToBranch = async function (productId) {
    const branch_id = document.getElementById("branch_" + productId).value;
    const qty = Number(document.getElementById("branch_qty_" + productId).value);

    if (!branch_id || qty <= 0) {
        alert("Please select branch and enter valid quantity");
        return;
    }

    try {
        const data = await fetchJson("/receive-to-branch", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ branch_id, product_id: productId, qty })
        });

        alert(data.message || "Stock received");
        loadProducts();
        loadDashboard();

        if (typeof loadBranchStock === "function") loadBranchStock();
        if (typeof loadBranchDashboard === "function") loadBranchDashboard();
    } catch (err) {
        alert(err.message);
    }
};

window.importProducts = async function () {
    const fileInput = document.getElementById("importFile");

    if (!fileInput || !fileInput.files.length) {
        alert("Please select file");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const data = await fetchJson("/import-products", {
            method: "POST",
            body: formData
        });

        alert(data.message || "Products imported");
        loadProducts();
        loadDashboard();
    } catch (err) {
        alert(err.message);
    }
};

// POS
window.loadSaleBranchOptions = async function () {
    try {
        const branches = await fetchJson("/branches");
        const select = document.getElementById("saleBranch");

        if (!select) return;

        select.innerHTML = "";

        branches.forEach(b => {
            select.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        });
    } catch (err) {
        console.error("Load sale branch options error:", err);
    }
};

window.previewBranchStock = async function () {
    const branch_id = document.getElementById("saleBranch")?.value;
    const barcode = document.getElementById("posBarcode")?.value.trim();

    if (!branch_id || !barcode) {
        setText("availableBranchStock", "0");
        return;
    }

    try {
        const data = await fetchJson(`/branch-stock-check?branch_id=${encodeURIComponent(branch_id)}&barcode=${encodeURIComponent(barcode)}`);
        setText("availableBranchStock", data.branch_stock ?? 0);
    } catch (err) {
        setText("availableBranchStock", "0");
    }
};

window.addToCart = async function () {
    const branch_id = document.getElementById("saleBranch").value;
    const barcode = document.getElementById("posBarcode").value.trim();
    const qty = Number(document.getElementById("posQty").value);

    if (!branch_id) {
        alert("Please select branch");
        return;
    }

    if (!barcode || qty <= 0) {
        alert("Please enter barcode and valid quantity");
        return;
    }

    try {
        const product = await fetchJson(`/branch-stock-check?branch_id=${encodeURIComponent(branch_id)}&barcode=${encodeURIComponent(barcode)}`);
        const branchStock = Number(product.branch_stock || 0);

        setText("availableBranchStock", branchStock);

        if (branchStock < qty) {
            alert("Not enough stock in selected branch");
            return;
        }

        const customerSelect = document.getElementById("saleCustomer");
        const customerName = customerSelect && customerSelect.value
            ? customerSelect.options[customerSelect.selectedIndex].text
            : "Walk-in Customer";

        const existing = cart.find(item =>
            Number(item.id) === Number(product.id) &&
            Number(item.branch_id) === Number(branch_id)
        );

        if (existing) {
            if (branchStock < existing.qty + qty) {
                alert("Not enough branch stock for total cart quantity");
                return;
            }

            existing.qty += qty;
            existing.customer_name = customerName;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                price: Number(product.price),
                qty: qty,
                uom: product.uom || "PCS",
                branch_id: branch_id,
                customer_name: customerName
            });
        }

        document.getElementById("posBarcode").value = "";
        document.getElementById("posQty").value = 1;
        setText("availableBranchStock", "0");

        displayCart();
    } catch (err) {
        alert(err.message);
    }
};

window.displayCart = function () {
    const table = document.getElementById("cartTable");
    const totalBox = document.getElementById("cartTotal");

    if (!table || !totalBox) return;

    table.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        const lineTotal = Number(item.price) * Number(item.qty);
        total += lineTotal;

        table.innerHTML += `
            <tr>
                <td>${safeHtml(item.name)}</td>
                <td>${safeHtml(item.barcode)}</td>
                <td>${safeHtml(item.uom || "PCS")}</td>
                <td>${item.qty}</td>
                <td>${formatMoney(item.price)}</td>
                <td>${formatMoney(lineTotal)}</td>
                <td><button onclick="removeFromCart(${index})">Remove</button></td>
            </tr>
        `;
    });

    totalBox.innerText = formatMoney(total);
};

window.removeFromCart = function (index) {
    cart.splice(index, 1);
    displayCart();
};

window.clearCart = function () {
    cart = [];
    displayCart();
};

window.checkoutCart = async function () {
    if (cart.length === 0) {
        alert("Cart is empty");
        return;
    }

    const branch_id = document.getElementById("saleBranch").value;

    if (!branch_id) {
        alert("Please select branch");
        return;
    }

    const customer_id = document.getElementById("saleCustomer")
        ? document.getElementById("saleCustomer").value
        : "";

    try {
        const items = cart.map(item => ({
            product_id: item.id,
            qty: item.qty
        }));

        const res = await fetch(API + "/checkout-invoice", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({
                branch_id,
                customer_id: customer_id || null,
                payment_method: "Cash",
                items
            })
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        printCartReceipt(data.invoice_no);

        alert("Sale completed successfully\nInvoice: " + data.invoice_no);

        cart = [];
        displayCart();

        loadProducts();
        loadDashboard();

        if (typeof loadBranchStock === "function") loadBranchStock();
        if (typeof loadBranchDashboard === "function") loadBranchDashboard();

        setText("availableBranchStock", "0");

    } catch (err) {
        console.error("CHECKOUT INVOICE ERROR:", err);
        alert("Checkout failed: " + err.message);
    }
};

window.printCartReceipt = function (invoiceNo) {
    let receiptWindow = window.open("", "_blank");

    let total = 0;
    let rows = "";

    cart.forEach(item => {
        const lineTotal = Number(item.price) * Number(item.qty);
        total += lineTotal;

        rows += `
            <tr>
                <td>${safeHtml(item.name)}</td>
                <td>${safeHtml(item.barcode)}</td>
                <td>${item.qty} ${safeHtml(item.uom || "PCS")}</td>
                <td>${formatMoney(item.price)}</td>
                <td>${formatMoney(lineTotal)}</td>
            </tr>
        `;
    });

    const invoiceNumber = invoiceNo || ("INV-" + Date.now());

    const customerSelect = document.getElementById("saleCustomer");
    const customerName = customerSelect && customerSelect.value
        ? customerSelect.options[customerSelect.selectedIndex].text
        : "Walk-in Customer";

    const branchSelect = document.getElementById("saleBranch");
    const branchName = branchSelect && branchSelect.value
        ? branchSelect.options[branchSelect.selectedIndex].text
        : "";

    const paymentMethod = "Cash";
    const cashier = localStorage.getItem("username") || currentRole || "User";

    const html = `
        <html>
        <head>
            <title>${invoiceNumber}</title>
            <style>
                @page { size: A4; margin: 12mm; }
                body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 0; background: white; }
                .invoice { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111827; padding-bottom: 15px; margin-bottom: 20px; }
                .company { display: flex; align-items: center; gap: 15px; }
                .company img { width: 75px; height: 75px; object-fit: contain; }
                .company h1 { margin: 0; font-size: 24px; color: #111827; }
                .company p { margin: 3px 0; font-size: 13px; color: #4b5563; }
                .invoice-title { text-align: right; }
                .invoice-title h2 { margin: 0; font-size: 28px; color: #111827; }
                .invoice-title p { margin: 5px 0; font-size: 14px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
                .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
                .info-box h3 { margin: 0 0 8px 0; font-size: 15px; color: #111827; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
                .info-box p { margin: 5px 0; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background: #111827; color: white; padding: 10px; font-size: 14px; border: 1px solid #111827; }
                td { padding: 10px; font-size: 14px; border: 1px solid #d1d5db; text-align: center; }
                td:first-child { text-align: left; }
                .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
                .totals-box { width: 300px; border: 1px solid #111827; }
                .totals-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #d1d5db; font-size: 15px; }
                .totals-row:last-child { border-bottom: none; background: #111827; color: white; font-size: 18px; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                .signature-area { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
                .signature { flex: 1; border-top: 1px solid #111827; text-align: center; padding-top: 8px; font-size: 13px; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .invoice { border: none; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <div class="company">
                        <img src="logo.png" alt="Logo">
                        <div>
                            <h1>Mart & Wholesales</h1>
                            <p>Beirut, Lebanon</p>
                            <p>Phone: +961 3 743 351</p>
                            <p>Email: martwholesales@gmail.com</p>
                        </div>
                    </div>
                    <div class="invoice-title">
                        <h2>INVOICE</h2>
                        <p><strong>No:</strong> ${invoiceNumber}</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-box">
                        <h3>Customer Information</h3>
                        <p><strong>Customer:</strong> ${safeHtml(customerName)}</p>
                    </div>

                    <div class="info-box">
                        <h3>Sale Information</h3>
                        <p><strong>Branch:</strong> ${safeHtml(branchName)}</p>
                        <p><strong>Cashier:</strong> ${safeHtml(cashier)}</p>
                        <p><strong>Payment:</strong> ${paymentMethod}</p>
                        <p><strong>Currency:</strong> ${systemCurrency}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Barcode</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>

                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row">
                            <span>Subtotal</span>
                            <span>${formatMoney(total)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Discount</span>
                            <span>${formatMoney(0)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Grand Total</span>
                            <span>${formatMoney(total)}</span>
                        </div>
                    </div>
                </div>

                <div class="signature-area">
                    <div class="signature">Customer Signature</div>
                    <div class="signature">Authorized Signature</div>
                </div>

                <div class="footer">
                    Thank you for your business<br>
                    This invoice was generated by POS Inventory System.
                </div>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;

    receiptWindow.document.write(html);
    receiptWindow.document.close();
};

// RECEIVING
window.receiveByBarcode = async function () {
    const barcode = document.getElementById("receiveBarcode").value.trim();
    const qty = Number(document.getElementById("receiveQty").value);

    if (!barcode || qty <= 0) {
        alert("Please enter barcode and valid quantity");
        return;
    }

    try {
        const branches = await fetchJson("/branches");
        const mainBranch = branches.find(b => String(b.name).toLowerCase() === "main");

        if (!mainBranch) {
            alert("Main branch not found. Please create branch named Main first.");
            return;
        }

        const products = await fetchJson("/products");
        const product = products.find(p => String(p.barcode) === barcode);

        if (!product) {
            alert("Product not found");
            return;
        }

        const data = await fetchJson("/receive-to-branch", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ branch_id: mainBranch.id, product_id: product.id, qty })
        });

        alert(data.message || "Stock received to Main branch");

        document.getElementById("receiveBarcode").value = "";
        document.getElementById("receiveQty").value = "";

        loadProducts();
        loadDashboard();
        loadBranchStock();
    } catch (err) {
        alert(err.message);
    }
};

// BRANCHES
window.addBranch = async function () {
    const name = document.getElementById("branchName").value.trim();
    const location = document.getElementById("branchLocation").value.trim();

    if (!name) {
        alert("Please enter branch name");
        return;
    }

    try {
        const data = await fetchJson("/branches", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ name, location })
        });

        alert(data.message || "Branch added");

        document.getElementById("branchName").value = "";
        document.getElementById("branchLocation").value = "";

        loadBranches();
        loadBranchStockOptions();
        loadTransferOptions();
    } catch (err) {
        alert(err.message);
    }
};

window.loadBranches = async function () {
    try {
        const branches = await fetchJson("/branches");
        const table = document.getElementById("branchesTable");

        if (!table) return;

        table.innerHTML = "";

        branches.forEach(b => {
            table.innerHTML += `
                <tr>
                    <td>${b.id}</td>
                    <td>${safeHtml(b.name)}</td>
                    <td>${safeHtml(b.location || "")}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Branches error:", err);
    }
};
window.loadBranchStockOptions = async function () {
    try {
        const branches = await fetchJson("/branches");
        const products = await fetchJson("/products");

        const branchSelect = document.getElementById("stockBranch");
        const productSelect = document.getElementById("stockProduct");

        if (!branchSelect || !productSelect) return;

        branchSelect.innerHTML = "";
        productSelect.innerHTML = "";

        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        });

        products.forEach(p => {
            productSelect.innerHTML += `<option value="${p.id}">${safeHtml(p.name)} - ${safeHtml(p.barcode)}</option>`;
        });
    } catch (err) {
        console.error("Branch stock options error:", err);
    }
};

window.saveBranchStock = async function () {
    const branch_id = document.getElementById("stockBranch").value;
    const product_id = document.getElementById("stockProduct").value;
    const stock = Number(document.getElementById("branchStockQty").value);

    if (!branch_id || !product_id || stock < 0) {
        alert("Please select branch/product and enter valid stock");
        return;
    }

    try {
        const data = await fetchJson("/branch-stock", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ branch_id, product_id, stock })
        });

        alert(data.message || "Branch stock updated");

        document.getElementById("branchStockQty").value = "";
        loadBranchStock();
        loadProducts();
        loadDashboard();
        loadBranchDashboard();
    } catch (err) {
        alert(err.message);
    }
};

window.loadBranchStock = async function () {
    try {
        const rows = await fetchJson("/branch-stock");
        const table = document.getElementById("branchStockTable");

        if (!table) return;

        table.innerHTML = "";

        rows.forEach(r => {
            table.innerHTML += `
                <tr>
                    <td>${r.id}</td>
                    <td>${safeHtml(r.branch_name)}</td>
                    <td>${safeHtml(r.product_name)}</td>
                    <td>${safeHtml(r.barcode)}</td>
                    <td>${r.stock}</td>
                    <td>${r.min_stock || 0}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Branch stock error:", err);
    }
};

window.loadTransferOptions = async function () {
    try {
        const branches = await fetchJson("/branches");
        const products = await fetchJson("/products");

        const fromBranch = document.getElementById("fromBranch");
        const toBranch = document.getElementById("toBranch");
        const transferProduct = document.getElementById("transferProduct");

        if (!fromBranch || !toBranch || !transferProduct) return;

        fromBranch.innerHTML = "";
        toBranch.innerHTML = "";
        transferProduct.innerHTML = "";

        branches.forEach(b => {
            const option = `<option value="${b.id}">${safeHtml(b.name)}</option>`;
            fromBranch.innerHTML += option;
            toBranch.innerHTML += option;
        });

        products.forEach(p => {
            transferProduct.innerHTML += `<option value="${p.id}">${safeHtml(p.name)} - ${safeHtml(p.barcode)}</option>`;
        });
    } catch (err) {
        console.error("Transfer options error:", err);
    }
};

window.transferStock = async function () {
    const from_branch_id = document.getElementById("fromBranch").value;
    const to_branch_id = document.getElementById("toBranch").value;
    const product_id = document.getElementById("transferProduct").value;
    const qty = Number(document.getElementById("transferQty").value);

    if (!from_branch_id || !to_branch_id || !product_id || qty <= 0) {
        alert("Please select branches/product and enter valid quantity");
        return;
    }

    try {
        const data = await fetchJson("/stock-transfer", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ from_branch_id, to_branch_id, product_id, qty })
        });

        alert(data.message || "Stock transferred");
        document.getElementById("transferQty").value = "";

        loadBranchStock();
        loadStockTransfers();
        loadBranchDashboard();
    } catch (err) {
        alert(err.message);
    }
};

window.loadStockTransfers = async function () {
    try {
        const transfers = await fetchJson("/stock-transfers");
        const table = document.getElementById("stockTransfersTable");

        if (!table) return;

        table.innerHTML = "";

        transfers.forEach(t => {
            table.innerHTML += `
                <tr>
                    <td>${t.id}</td>
                    <td>${safeHtml(t.from_branch)}</td>
                    <td>${safeHtml(t.to_branch)}</td>
                    <td>${safeHtml(t.product_name)}</td>
                    <td>${safeHtml(t.barcode)}</td>
                    <td>${t.qty}</td>
                    <td>${safeHtml(t.date)}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Transfers error:", err);
    }
};

window.syncStockToMain = async function () {
    if (!confirm("Move all unassigned stock to Main branch?")) return;

    try {
        const data = await fetchJson("/sync-stock-to-main", {
            method: "POST",
            headers: authHeaders()
        });

        alert((data.message || "Stock synced") + (data.productsUpdated !== undefined ? `\nProducts updated: ${data.productsUpdated}` : ""));

        loadProducts();
        loadBranchStock();
        loadDashboard();
        loadBranchDashboard();
    } catch (err) {
        alert(err.message);
    }
};
window.clearPOFilters = function () {
    const searchInput = document.getElementById("poSearchInput");
    const statusFilter = document.getElementById("poStatusFilter");

    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "";

    loadPurchaseOrders();
};

window.receiveAllPurchaseOrder = async function (poNo) {
    if (!poNo) {
        alert("PO number is missing");
        return;
    }

    if (!confirm("Receive all remaining items for PO " + poNo + "?")) return;

    const res = await fetch(API + "/purchase-orders/" + encodeURIComponent(poNo) + "/receive-all", {
        method: "PUT",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadPurchaseOrders();
    loadProducts();
    loadDashboard();

    if (typeof loadBranchStock === "function") {
        loadBranchStock();
    }

    if (typeof loadBranchDashboard === "function") {
        loadBranchDashboard();
    }

    if (typeof loadSupplierHistory === "function") {
        loadSupplierHistory();
    }

    if (typeof loadSupplierBalanceReport === "function") {
        loadSupplierBalanceReport();
    }

    if (typeof loadStockAuditReport === "function") {
        loadStockAuditReport();
    }
};

window.loadSuppliersList = async function () {
    const res = await fetch(API + "/suppliers");
    const suppliers = await res.json();

    const table = document.getElementById("suppliersListTable");
    if (!table) return;

    table.innerHTML = "";

    suppliers.forEach(s => {
        table.innerHTML += `
            <tr>
                <td>${s.id}</td>
                <td>${safeHtml(s.name)}</td>
                <td>${safeHtml(s.phone || "")}</td>
                <td>${safeHtml(s.email || "")}</td>
                <td>${safeHtml(s.address || "")}</td>
                <td>
                    ${
                        currentRole === "admin"
                        ? `<button onclick="editSupplierName(${s.id}, '${String(s.name).replace(/'/g, "\\'")}')">Edit Name</button>`
                        : ""
                    }
                </td>
            </tr>
        `;
    });
};

window.editSupplierName = async function (id, oldName) {
    const newName = prompt("Enter new supplier name:", oldName);

    if (newName === null) return;

    if (!newName.trim()) {
        alert("Supplier name cannot be empty");
        return;
    }

    if (newName.trim() === oldName) {
        return;
    }

    const res = await fetch(API + "/suppliers/" + id + "/name", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            name: newName.trim()
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadSuppliersList();
    loadSupplierOptions();

    if (typeof loadPurchaseOrders === "function") {
        loadPurchaseOrders();
    }

    if (typeof loadSupplierBalanceReport === "function") {
        loadSupplierBalanceReport();
    }
};

// SUPPLIERS / PURCHASE ORDERS
window.addSupplier = async function () {
    const name = document.getElementById("supplierName").value.trim();
    const phone = document.getElementById("supplierPhone").value.trim();
    const email = document.getElementById("supplierEmail").value.trim();
    const address = document.getElementById("supplierAddress").value.trim();

    if (!name) {
        alert("Please enter supplier name");
        return;
    }

    try {
        const data = await fetchJson("/suppliers", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ name, phone, email, address })
        });

        alert(data.message || "Supplier added");
        document.getElementById("supplierName").value = "";
        document.getElementById("supplierPhone").value = "";
        document.getElementById("supplierEmail").value = "";
        document.getElementById("supplierAddress").value = "";

        loadSupplierOptions();
    } catch (err) {
        alert(err.message);
    }
};

window.loadSupplierOptions = async function () {
    try {
        const suppliers = await fetchJson("/suppliers");
        const products = await fetchJson("/products");
        const branches = await fetchJson("/branches");

        poProductsCache = products;

        const supplierSelect = document.getElementById("poSupplier");
        const productSelect = document.getElementById("poProduct");
        const branchSelect = document.getElementById("poBranch");

        if (!supplierSelect || !productSelect || !branchSelect) return;

        supplierSelect.innerHTML = "";
        productSelect.innerHTML = "";
        branchSelect.innerHTML = "";

        suppliers.forEach(s => {
            supplierSelect.innerHTML += `
                <option value="${s.id}">
                    ${safeHtml(s.name)}
                </option>
            `;
        });

        products.forEach(p => {
            productSelect.innerHTML += `
                <option value="${p.id}">
                    ${safeHtml(p.name)} - ${safeHtml(p.barcode)} - ${safeHtml(p.uom || "PCS")}
                </option>
            `;
        });

        branches.forEach(b => {
            branchSelect.innerHTML += `
                <option value="${b.id}">
                    ${safeHtml(b.name)}
                </option>
            `;
        });

    } catch (err) {
        console.error("Supplier options error:", err);
    }
};

window.addPOLine = function () {
    const productSelect = document.getElementById("poProduct");
    const qtyInput = document.getElementById("poQty");

    const product_id = productSelect.value;
    const qty = Number(qtyInput.value);

    if (!product_id || qty <= 0) {
        alert("Please select product and enter valid quantity");
        return;
    }

    const product = poProductsCache.find(p => Number(p.id) === Number(product_id));

    if (!product) {
        alert("Product not found");
        return;
    }

    const existing = poLines.find(line => Number(line.product_id) === Number(product_id));

    if (existing) {
        existing.qty += qty;
    } else {
        poLines.push({
            product_id: product.id,
            product_name: product.name,
            barcode: product.barcode,
            uom: product.uom || "PCS",
            qty: qty
        });
    }

    qtyInput.value = "";

    displayPOLines();
};

window.displayPOLines = function () {
    const table = document.getElementById("poLinesTable");
    if (!table) return;

    table.innerHTML = "";

    poLines.forEach((line, index) => {
        table.innerHTML += `
            <tr>
                <td>${safeHtml(line.product_name)}</td>
                <td>${safeHtml(line.barcode)}</td>
                <td>${safeHtml(line.uom || "PCS")}</td>
                <td>${line.qty}</td>
                <td><button onclick="removePOLine(${index})">Remove</button></td>
            </tr>
        `;
    });
};

window.removePOLine = function (index) {
    poLines.splice(index, 1);
    displayPOLines();
};

window.clearPOLines = function () {
    poLines = [];
    displayPOLines();
};

window.createMultiPurchaseOrder = async function () {
    const supplier_id = document.getElementById("poSupplier").value;
    const branch_id = document.getElementById("poBranch").value;

    if (!supplier_id || !branch_id) {
        alert("Please select supplier and branch");
        return;
    }

    if (poLines.length === 0) {
        alert("Please add at least one PO line");
        return;
    }

    const items = poLines.map(line => ({
        product_id: line.product_id,
        qty: line.qty
    }));

    const res = await fetch(API + "/purchase-orders-multiple", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            supplier_id,
            branch_id,
            items
        })
    });

    const data = await res.json();

    alert(
        data.message
        ? `${data.message}\nPO No: ${data.po_no}\nLines: ${data.lines}`
        : data.error
    );

    if (data.message) {
        poLines = [];
        displayPOLines();
        loadPurchaseOrders();
    }
};

window.createPurchaseOrder = async function () {
    const supplier_id = document.getElementById("poSupplier").value;
    const product_id = document.getElementById("poProduct").value;
    const branch_id = document.getElementById("poBranch").value;
    const qty = Number(document.getElementById("poQty").value);

    if (!supplier_id || !product_id || !branch_id || qty <= 0) {
        alert("Please select supplier, product, branch and enter valid qty");
        return;
    }

    try {
        const data = await fetchJson("/purchase-orders", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ supplier_id, product_id, branch_id, qty })
        });

        alert(data.message || "Purchase order created");
        document.getElementById("poQty").value = "";
        loadPurchaseOrders();
    } catch (err) {
        alert(err.message);
    }
};

window.cancelPurchaseOrder = async function (id) {
    const reason = prompt("Enter cancellation reason:");

    if (reason === null) return;

    if (!reason.trim()) {
        alert("Cancellation reason is required");
        return;
    }

    if (!confirm("Cancel this purchase order line?")) return;

    const res = await fetch(API + "/purchase-orders/" + id + "/cancel", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            reason: reason.trim()
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadPurchaseOrders();

    if (typeof loadSupplierHistory === "function") {
        loadSupplierHistory();
    }

    if (typeof loadSupplierBalanceReport === "function") {
        loadSupplierBalanceReport();
    }
};

window.loadPurchaseOrders = async function () {
    const res = await fetch(API + "/purchase-orders");
    const orders = await res.json();

    const table = document.getElementById("purchaseOrdersTable");
    if (!table) return;

    const searchInput = document.getElementById("poSearchInput");
    const statusFilter = document.getElementById("poStatusFilter");

    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const status = statusFilter ? statusFilter.value : "";

    const filteredOrders = orders.filter(o => {
        const poNo = String(o.po_no || ("PO-" + o.id) || "").toLowerCase();
        const supplier = String(o.supplier_name || "").toLowerCase();
        const product = String(o.product_name || "").toLowerCase();
        const barcode = String(o.barcode || "").toLowerCase();
        const uom = String(o.uom || "PCS").toLowerCase();
        const branch = String(o.branch_name || "").toLowerCase();
        const orderStatus = String(o.status || "");

        const matchesSearch =
            !search ||
            poNo.includes(search) ||
            supplier.includes(search) ||
            product.includes(search) ||
            barcode.includes(search) ||
            uom.includes(search) ||
            branch.includes(search) ||
            orderStatus.toLowerCase().includes(search);

        const matchesStatus =
            !status ||
            orderStatus === status;

        return matchesSearch && matchesStatus;
    });

    setText("poFilteredCount", filteredOrders.length);

    table.innerHTML = "";

    filteredOrders.forEach(o => {
        table.innerHTML += `
            <tr>
                <td>${o.id}</td>
                <td>${safeHtml(o.po_no || ("PO-" + o.id))}</td>
                <td>${safeHtml(o.supplier_name || "")}</td>
                <td>${safeHtml(o.product_name || "")}</td>
                <td>${safeHtml(o.barcode || "")}</td>
                <td>${safeHtml(o.uom || "PCS")}</td>
                <td>${safeHtml(o.branch_name || "")}</td>
                <td>${o.qty}</td>
                <td>${o.received_qty || 0}</td>
                <td>${o.remaining_qty || 0}</td>
                <td>${safeHtml(o.status || "")}</td>
                <td>${safeHtml(o.cancel_reason || "")}</td>
                <td>${new Date(o.date).toLocaleString()}</td>
                <td>
                    ${
                        o.status === "Received"
                        ? "Received"
                        : o.status === "Cancelled"
                            ? "Cancelled"
                            : `<button onclick="receivePurchaseOrder(${o.id}, ${o.remaining_qty || o.qty})">Receive</button>`
                    }
                </td>
                <td>
                    ${
                        o.status === "Received" || o.status === "Cancelled"
                        ? ""
                        : `<button onclick="receiveAllPurchaseOrder('${o.po_no || ("PO-" + o.id)}')">Receive All</button>`
                    }
                </td>
                <td>
                    ${
                        o.status === "Received" || o.status === "Cancelled"
                        ? ""
                        : `<button onclick="cancelPurchaseOrder(${o.id})">Cancel</button>`
                    }
                </td>
            </tr>
        `;
    });
};

window.receivePurchaseOrder = async function (id, remainingQty) {
    const qty = prompt(`Enter received quantity. Remaining quantity: ${remainingQty}`);

    if (!qty) return;

    const receivedQty = Number(qty);

    if (receivedQty <= 0) {
        alert("Please enter valid received quantity");
        return;
    }

    if (receivedQty > Number(remainingQty)) {
        alert("Received quantity cannot exceed remaining quantity");
        return;
    }

    const res = await fetch(API + "/purchase-orders/" + id + "/receive", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            received_qty: receivedQty
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadPurchaseOrders();
    loadProducts();
    loadDashboard();

    if (typeof loadBranchStock === "function") loadBranchStock();
    if (typeof loadBranchDashboard === "function") loadBranchDashboard();
    if (typeof loadSupplierHistory === "function") loadSupplierHistory();
    if (typeof loadSupplierBalanceReport === "function") loadSupplierBalanceReport();
};
function reportHeaderCss() {
    return `
        .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #111827;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }

        .company-block {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .company-block img {
            width: 70px;
            height: 70px;
            object-fit: contain;
        }

        .company-block h2 {
            margin: 0;
            font-size: 22px;
        }

        .company-block p {
            margin: 3px 0;
            font-size: 13px;
            color: #4b5563;
        }

        .report-title {
            text-align: right;
        }

        .report-title h1 {
            margin: 0;
            font-size: 24px;
        }

        .report-title p {
            margin: 5px 0;
            font-size: 13px;
        }
    `;
}

function reportHeaderHtml(title) {
    return `
        <div class="report-header">
            <div class="company-block">
                <img src="logo.png" alt="Logo">
                <div>
                    <h2>Mart & Wholesales</h2>
                    <p>Beirut, Lebanon</p>
                    <p>Phone: +961 3 743 351</p>
                    <p>Email: martwholesales@gmail.com</p>
                </div>
            </div>

            <div class="report-title">
                <h1>${safeHtml(title)}</h1>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Currency:</strong> ${systemCurrency}</p>
            </div>
        </div>
    `;
}
// REPORTS
function openReportWindow(title, bodyHtml) {
    const reportWindow = window.open("", "_blank");

    reportWindow.document.write(`
        <html>
        <head>
            <title>${safeHtml(title)}</title>
            <style>
                body { font-family: Arial; padding: 20px; color: #111827; }
                .report-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 3px solid #111827;
                    padding-bottom: 12px;
                    margin-bottom: 20px;
                }
                .company-block {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .company-block img {
                    width: 70px;
                    height: 70px;
                    object-fit: contain;
                }
                .company-block h2 {
                    margin: 0;
                    font-size: 22px;
                }
                .company-block p {
                    margin: 3px 0;
                    font-size: 13px;
                    color: #4b5563;
                }
                .report-title {
                    text-align: right;
                }
                .report-title h1 {
                    margin: 0;
                    font-size: 24px;
                }
                .report-title p {
                    margin: 5px 0;
                    font-size: 13px;
                }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
                .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 15px; }

                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div class="company-block">
                    <img src="logo.png" alt="Logo">
                    <div>
                        <h2>Mart & Wholesales</h2>
                        <p>Beirut, Lebanon</p>
                        <p>Phone: +961 3 743 351</p>
                        <p>Email: martwholesales@gmail.com</p>
                    </div>
                </div>

                <div class="report-title">
                    <h1>${safeHtml(title)}</h1>
                    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Currency:</strong> ${systemCurrency}</p>
                </div>
            </div>

            ${bodyHtml}

            <script>window.print();</script>
        </body>
        </html>
    `);

    reportWindow.document.close();
}
window.printInventoryReport = async function () {
    const products = await fetchJson("/products");
    const rows = products.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${safeHtml(p.name)}</td>
            <td>${safeHtml(p.barcode)}</td>
            <td>${formatMoney(p.price)}</td>
            <td>${p.stock}</td>
        </tr>
    `).join("");

    openReportWindow("Inventory Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Price</th>
                    <th>Stock</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};

window.exportInventoryExcel = async function () {
    const products = await fetchJson("/products");
    let csv = "ID,Product,Barcode,Price,Stock\n";

    products.forEach(p => {
        csv += `${p.id},${p.name},${p.barcode},${p.price},${p.stock}\n`;
    });

    downloadCsv(csv, "inventory_report.csv");
};

window.printSalesReport = async function () {
    const sales = await fetchJson("/sales-report");

    const rows = sales.map(s => `
        <tr>
            <td>${s.id}</td>
            <td>${safeHtml(s.product_name)}</td>
            <td>${safeHtml(s.barcode)}</td>
            <td>${s.qty}</td>
            <td>${formatMoney(Number(s.price) / Number(s.qty || 1))}</td>
            <td>${formatMoney(s.price)}</td>
            <td>${safeHtml(s.date)}</td>
        </tr>
    `).join("");

    openReportWindow("Sales Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};

window.exportSalesExcel = async function () {
    const sales = await fetchJson("/sales-report");
    let csv = "ID,Product,Barcode,Qty,Unit Price,Total,Date\n";

    sales.forEach(s => {
        csv += `${s.id},${s.product_name},${s.barcode},${s.qty},${money(Number(s.price) / Number(s.qty || 1))},${money(s.price)},${s.date}\n`;
    });

    downloadCsv(csv, "sales_report.csv");
};

window.printReceivingReport = async function () {
    const receiving = await fetchJson("/receiving-report");

    const rows = receiving.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${safeHtml(r.product_name)}</td>
            <td>${safeHtml(r.barcode)}</td>
            <td>${r.qty}</td>
            <td>${safeHtml(r.date)}</td>
        </tr>
    `).join("");

    openReportWindow("Receiving Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Qty</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};

window.exportReceivingExcel = async function () {
    const receiving = await fetchJson("/receiving-report");
    let csv = "ID,Product,Barcode,Qty,Date\n";

    receiving.forEach(r => {
        csv += `${r.id},${r.product_name},${r.barcode},${r.qty},${r.date}\n`;
    });

    downloadCsv(csv, "receiving_report.csv");
};

window.printBranchSalesReport = async function () {
    const sales = await fetchJson("/branch-sales-report");

    const rows = sales.map(s => {
        const unitPrice = Number(s.price) / Number(s.qty || 1);

        return `
            <tr>
                <td>${s.id}</td>
                <td>${safeHtml(s.branch_name)}</td>
                <td>${safeHtml(s.customer_name || "Walk-in Customer")}</td>
                <td>${safeHtml(s.customer_phone || "")}</td>
                <td>${safeHtml(s.product_name)}</td>
                <td>${safeHtml(s.barcode)}</td>
                <td>${s.qty}</td>
                <td>${formatMoney(unitPrice)}</td>
                <td>${formatMoney(s.price)}</td>
                <td>${formatMoney(s.profit)}</td>
                <td>${safeHtml(s.date)}</td>
            </tr>
        `;
    }).join("");

    openReportWindow("Branch Sales Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Branch</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>Profit</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};

window.exportBranchSalesExcel = async function () {
    const sales = await fetchJson("/branch-sales-report");
    let csv = "ID,Branch,Customer,Phone,Product,Barcode,Qty,Unit Price,Total,Profit,Date\n";

    sales.forEach(s => {
        const unitPrice = Number(s.price || 0) / Number(s.qty || 1);
        const total = Number(s.price || 0);
        const profit = Number(s.profit || 0);

        csv += `${s.id},${s.branch_name},${s.customer_name || "Walk-in Customer"},${s.customer_phone || ""},${s.product_name},${s.barcode},${s.qty},${unitPrice.toFixed(2)},${total.toFixed(2)},${profit.toFixed(2)},${s.date}\n`;
    });

    downloadCsv(csv, "branch_sales_report.csv");
};

window.printTransferReport = async function () {
    const transfers = await fetchJson("/stock-transfers");

    const rows = transfers.map(t => `
        <tr>
            <td>${t.id}</td>
            <td>${safeHtml(t.from_branch)}</td>
            <td>${safeHtml(t.to_branch)}</td>
            <td>${safeHtml(t.product_name)}</td>
            <td>${safeHtml(t.barcode)}</td>
            <td>${t.qty}</td>
            <td>${safeHtml(t.date)}</td>
        </tr>
    `).join("");

    openReportWindow("Stock Transfer Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>From Branch</th>
                    <th>To Branch</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Qty</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};

window.exportTransferExcel = async function () {
    const transfers = await fetchJson("/stock-transfers");
    let csv = "ID,From Branch,To Branch,Product,Barcode,Qty,Date\n";

    transfers.forEach(t => {
        csv += `${t.id},${t.from_branch},${t.to_branch},${t.product_name},${t.barcode},${t.qty},${t.date}\n`;
    });

    downloadCsv(csv, "stock_transfer_report.csv");
};

window.exportInvoicesExcel = async function () {
    const res = await fetch(API + "/invoices");
    const invoices = await res.json();

    let csv = "ID,Invoice No,Customer,Phone,Branch,Cashier,Payment,Total,Date\n";

    invoices.forEach(inv => {
        csv += `${inv.id},${inv.invoice_no},${inv.customer_name || "Walk-in Customer"},${inv.customer_phone || ""},${inv.branch_name || ""},${inv.cashier_name || ""},${inv.payment_method || "Cash"},${Number(inv.total || 0).toFixed(2)},${new Date(inv.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "invoice_report.csv");
};

function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// CHARTS
window.loadCharts = async function () {
    await loadSalesProfitChart();
    await loadStockChart();
};

window.loadSalesProfitChart = async function () {
    try {
        const data = await fetchJson("/charts/sales-profit");

        const labels = data.map(x => x.sale_date);
        const sales = data.map(x => Number(x.total_sales || 0));
        const profit = data.map(x => Number(x.total_profit || 0));

        const ctx = document.getElementById("salesProfitChart");
        if (!ctx) return;

        if (salesProfitChart) salesProfitChart.destroy();

        salesProfitChart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    { label: "Sales", data: sales },
                    { label: "Profit", data: profit }
                ]
            },
            options: { responsive: true }
        });
    } catch (err) {
        console.error("Sales chart error:", err);
    }
};

window.loadStockChart = async function () {
    try {
        const data = await fetchJson("/charts/stock");

        const labels = data.map(x => x.name);
        const stock = data.map(x => Number(x.stock || 0));

        const ctx = document.getElementById("stockChart");
        if (!ctx) return;

        if (stockChart) stockChart.destroy();

        stockChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{ label: "Current Stock", data: stock }]
            },
            options: { responsive: true }
        });
    } catch (err) {
        console.error("Stock chart error:", err);
    }
};

// SCANNERS
window.startPOSScanner = function () {
    stopScanner();

    html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => {
            document.getElementById("posBarcode").value = decodedText;
            stopScanner();
            previewBranchStock();
            addToCart();
        },
        () => {}
    ).catch(err => alert("Camera error: " + err));
};

window.startReceivingScanner = function () {
    stopScanner();

    html5QrCode = new Html5Qrcode("receivingReader");

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => {
            document.getElementById("receiveBarcode").value = decodedText;
            stopScanner();
            document.getElementById("receiveQty").focus();
        },
        () => {}
    ).catch(err => alert("Camera error: " + err));
};

window.stopScanner = function () {
    if (html5QrCode) {
        html5QrCode.stop()
            .then(() => {
                html5QrCode.clear();
                html5QrCode = null;
            })
            .catch(() => {
                html5QrCode = null;
            });
    }
};
// INIT
window.addEventListener("load", async () => {
    await window.loadSystemCurrency();

    const savedToken = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");

    if (savedToken && savedRole) {
        token = savedToken;
        currentRole = savedRole;

        window.applyRolePermissions();

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        const adminSection = document.getElementById("adminSection");
        if (adminSection) {
            adminSection.style.display = currentRole === "admin" ? "block" : "none";
        }

        const usersMenuBtn = document.getElementById("usersMenuBtn");
        if (usersMenuBtn) {
            usersMenuBtn.style.display = currentRole === "admin" ? "block" : "none";
        }

        if (currentRole === "cashier") {
            showPage("posPage");
        } else if (currentRole === "warehouse") {
            showPage("productsPage");
        } else {
            showPage("dashboardPage");
        }

    } else {
        document.getElementById("loginSection").style.display = "block";
        document.getElementById("mainSection").style.display = "none";
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const barcodeSearchInput = document.getElementById("barcodeSearchInput");
    if (barcodeSearchInput) {
        barcodeSearchInput.addEventListener("keypress", e => {
            if (e.key === "Enter") searchByBarcode();
        });
    }

    const receiveBarcode = document.getElementById("receiveBarcode");
    if (receiveBarcode) {
        receiveBarcode.addEventListener("keypress", e => {
            if (e.key === "Enter") {
                const receiveQty = document.getElementById("receiveQty");
                if (receiveQty) receiveQty.focus();
            }
        });
    }

    const receiveQty = document.getElementById("receiveQty");
    if (receiveQty) {
        receiveQty.addEventListener("keypress", e => {
            if (e.key === "Enter") receiveByBarcode();
        });
    }

    const posBarcode = document.getElementById("posBarcode");
    if (posBarcode) {
        posBarcode.addEventListener("change", previewBranchStock);
        posBarcode.addEventListener("keyup", e => {
            if (e.key === "Enter") {
                addToCart();
            } else {
                previewBranchStock();
            }
        });
    }

    const saleBranch = document.getElementById("saleBranch");
    if (saleBranch) {
        saleBranch.addEventListener("change", previewBranchStock);
    }

    const returnInvoice = document.getElementById("returnInvoice");
    if (returnInvoice) {
        returnInvoice.addEventListener("change", loadReturnInvoiceItems);
    }

    const returnProduct = document.getElementById("returnCustomerProduct");
    if (returnProduct) {
        returnProduct.addEventListener("change", calculateCustomerRefund);
    }

    const returnQty = document.getElementById("customerReturnQty");
    if (returnQty) {
        returnQty.addEventListener("input", calculateCustomerRefund);
    }
    const poSearchInput = document.getElementById("poSearchInput");
if (poSearchInput) {
    poSearchInput.addEventListener("keyup", e => {
        loadPurchaseOrders();
    });
}

const poStatusFilter = document.getElementById("poStatusFilter");
if (poStatusFilter) {
    poStatusFilter.addEventListener("change", loadPurchaseOrders);
}

});

// CUSTOMERS
window.addCustomer = async function () {
    const name = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const address = document.getElementById("customerAddress").value.trim();

    if (!name || !phone) {
        alert("Customer name and phone are required");
        return;
    }

    const res = await fetch(API + "/customers", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ name, phone, email, address })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("customerName").value = "";
    document.getElementById("customerPhone").value = "";
    document.getElementById("customerEmail").value = "";
    document.getElementById("customerAddress").value = "";

    loadCustomers();
};

window.loadCustomers = async function () {
    const res = await fetch(API + "/customers");
    const customers = await res.json();

    displayCustomers(customers);
};

window.displayCustomers = function (customers) {
    const table = document.getElementById("customersTable");
    if (!table) return;

    table.innerHTML = "";

    customers.forEach(c => {
        table.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${safeHtml(c.name)}</td>
                <td>${safeHtml(c.phone)}</td>
                <td>${safeHtml(c.email || "")}</td>
                <td>${safeHtml(c.address || "")}</td>
                <td>${safeHtml(c.date || "")}</td>
                <td>
                    ${
                        currentRole === "admin"
                        ? `<button onclick="deleteCustomer(${c.id})">Delete</button>`
                        : ""
                    }
                </td>
            </tr>
        `;
    });
};

window.searchCustomers = async function () {
    const search = document.getElementById("customerSearch").value.toLowerCase();

    const res = await fetch(API + "/customers");
    const customers = await res.json();

    const filtered = customers.filter(c =>
        String(c.name || "").toLowerCase().includes(search) ||
        String(c.phone || "").toLowerCase().includes(search)
    );

    displayCustomers(filtered);
};

window.deleteCustomer = async function (id) {
    if (!confirm("Delete this customer?")) return;

    const res = await fetch(API + "/customers/" + id, {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadCustomers();
};

window.loadSaleCustomerOptions = async function () {
    const res = await fetch(API + "/customers");
    const customers = await res.json();

    const select = document.getElementById("saleCustomer");
    if (!select) return;

    select.innerHTML = `<option value="">Walk-in Customer</option>`;

    customers.forEach(c => {
        select.innerHTML += `
            <option value="${c.id}">
                ${safeHtml(c.name)} - ${safeHtml(c.phone)}
            </option>
        `;
    });
};

window.loadHistoryCustomerOptions = async function () {
    const res = await fetch(API + "/customers");
    const customers = await res.json();

    const select = document.getElementById("historyCustomer");
    if (!select) return;

    select.innerHTML = "";

    customers.forEach(c => {
        select.innerHTML += `
            <option value="${c.id}">
                ${safeHtml(c.name)} - ${safeHtml(c.phone)}
            </option>
        `;
    });
};

window.loadCustomerHistory = async function () {
    const customerId = document.getElementById("historyCustomer").value;

    if (!customerId) {
        alert("Please select customer");
        return;
    }

    const res = await fetch(API + "/customer-history/" + customerId);
    const rows = await res.json();

    const table = document.getElementById("customerHistoryTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        const unitPrice = Number(r.price) / Number(r.qty || 1);
        const total = Number(r.price || 0);
        const profit = Number(r.profit || 0);

        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(unitPrice)}</td>
                <td>${formatMoney(total)}</td>
                <td>${formatMoney(profit)}</td>
                <td>${safeHtml(r.date)}</td>
            </tr>
        `;
    });
};

window.printCustomerHistory = async function () {
    const customerId = document.getElementById("historyCustomer").value;

    if (!customerId) {
        alert("Please select customer");
        return;
    }

    const res = await fetch(API + "/customer-history/" + customerId);
    const rows = await res.json();

    const selectedText = document.getElementById("historyCustomer")
        .options[document.getElementById("historyCustomer").selectedIndex].text;

    let htmlRows = "";

    rows.forEach(r => {
        const unitPrice = Number(r.price) / Number(r.qty || 1);
        const total = Number(r.price || 0);
        const profit = Number(r.profit || 0);

        htmlRows += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(unitPrice)}</td>
                <td>${formatMoney(total)}</td>
                <td>${formatMoney(profit)}</td>
                <td>${safeHtml(r.date)}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Customer Purchase History</title>
            <style>
            ${reportHeaderCss()}
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
        ${reportHeaderHtml("Customer Purchase History")}
            <p><strong>Customer:</strong> ${safeHtml(selectedText)}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Currency:</strong> ${systemCurrency}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Branch</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                        <th>Profit</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${htmlRows}</tbody>
            </table>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportCustomerHistoryExcel = async function () {
    const customerId = document.getElementById("historyCustomer").value;

    if (!customerId) {
        alert("Please select customer");
        return;
    }

    const res = await fetch(API + "/customer-history/" + customerId);
    const rows = await res.json();

    let csv = "ID,Branch,Product,Barcode,Qty,Unit Price,Total,Profit,Date\n";

    rows.forEach(r => {
        const unitPrice = Number(r.price) / Number(r.qty || 1);
        const total = Number(r.price || 0);
        const profit = Number(r.profit || 0);

        csv += `${r.id},${r.branch_name},${r.product_name},${r.barcode},${r.qty},${unitPrice.toFixed(2)},${total.toFixed(2)},${profit.toFixed(2)},${r.date}\n`;
    });

    downloadCsv(csv, "customer_purchase_history.csv");
};

// EXPENSES
window.addExpense = async function () {
    const category = document.getElementById("expenseCategory").value.trim();
    const amount = Number(document.getElementById("expenseAmount").value);
    const notes = document.getElementById("expenseNotes").value.trim();

    if (!category || amount <= 0) {
        alert("Please enter category and valid amount");
        return;
    }

    const res = await fetch(API + "/expenses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ category, amount, notes })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("expenseCategory").value = "";
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseNotes").value = "";

    loadExpenses();
};

window.loadExpenses = async function () {
    const res = await fetch(API + "/expenses");
    const expenses = await res.json();

    const table = document.getElementById("expensesTable");
    if (!table) return;

    table.innerHTML = "";

    expenses.forEach(e => {
        table.innerHTML += `
            <tr>
                <td>${e.id}</td>
                <td>${safeHtml(e.category)}</td>
                <td>${formatMoney(e.amount || 0)}</td>
                <td>${safeHtml(e.notes || "")}</td>
                <td>${safeHtml(e.date)}</td>
                <td>
                    ${
                        currentRole === "admin"
                        ? `<button onclick="deleteExpense(${e.id})">Delete</button>`
                        : ""
                    }
                </td>
            </tr>
        `;
    });
};

window.deleteExpense = async function (id) {
    if (!confirm("Delete this expense?")) return;

    const res = await fetch(API + "/expenses/" + id, {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadExpenses();
};

window.printExpensesReport = async function () {
    const res = await fetch(API + "/expenses");
    const expenses = await res.json();

    let total = 0;
    let rows = "";

    expenses.forEach(e => {
        total += Number(e.amount || 0);

        rows += `
            <tr>
                <td>${e.id}</td>
                <td>${safeHtml(e.category)}</td>
                <td>${formatMoney(e.amount || 0)}</td>
                <td>${safeHtml(e.notes || "")}</td>
                <td>${safeHtml(e.date)}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Expenses Report</title>
            <style>
            ${reportHeaderCss()}
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
                .total { font-size: 20px; font-weight: bold; margin-top: 20px; text-align: right; }
            </style>
        </head>
        <body>
            <body>
    ${reportHeaderHtml("Expenses Report")}
            <p>Date: ${new Date().toLocaleString()}</p>
            <p>Currency: ${systemCurrency}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Notes</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <div class="total">Total Expenses: ${formatMoney(total)}</div>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportExpensesExcel = async function () {
    const res = await fetch(API + "/expenses");
    const expenses = await res.json();

    let csv = "ID,Category,Amount,Notes,Date\n";

    expenses.forEach(e => {
        csv += `${e.id},${e.category},${Number(e.amount || 0).toFixed(2)},${e.notes || ""},${e.date}\n`;
    });

    downloadCsv(csv, "expenses_report.csv");
};
// DAILY CLOSING
window.getClosingDate = function () {
    const input = document.getElementById("closingDateInput");

    if (input && input.value) {
        return input.value;
    }

    return new Date().toISOString().slice(0, 10);
};

window.loadDailyClosing = async function () {
    const date = getClosingDate();

    const dateInput = document.getElementById("closingDateInput");
    if (dateInput && !dateInput.value) {
        dateInput.value = date;
    }

    const res = await fetch(API + "/daily-closing?date=" + encodeURIComponent(date));
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    setText("closingSelectedDate", data.date);
    setText("closingSales", formatMoney(data.total_sales || 0));
    setText("closingProfit", formatMoney(data.total_profit || 0));
    setText("closingExpenses", formatMoney(data.total_expenses || 0));
    setText("closingRefunds", formatMoney(data.total_refunds || 0));
    setText("closingNetProfit", formatMoney(data.net_profit || 0));
    setText("closingTransactions", data.total_transactions || 0);
    setText("closingReturnsCount", data.total_returns || 0);

    const expensesTable = document.getElementById("closingExpensesTable");
    if (expensesTable) {
        expensesTable.innerHTML = "";

        (data.expenses || []).forEach(e => {
            expensesTable.innerHTML += `
                <tr>
                    <td>${e.id}</td>
                    <td>${safeHtml(e.category)}</td>
                    <td>${formatMoney(e.amount || 0)}</td>
                    <td>${safeHtml(e.notes || "")}</td>
                    <td>${new Date(e.date).toLocaleString()}</td>
                </tr>
            `;
        });
    }

    const returnsTable = document.getElementById("closingReturnsTable");
    if (returnsTable) {
        returnsTable.innerHTML = "";

        (data.returns || []).forEach(r => {
            returnsTable.innerHTML += `
                <tr>
                    <td>${r.id}</td>
                    <td>${safeHtml(r.customer_name || "Walk-in Customer")}</td>
                    <td>${safeHtml(r.product_name)}</td>
                    <td>${safeHtml(r.barcode)}</td>
                    <td>${safeHtml(r.branch_name)}</td>
                    <td>${r.qty}</td>
                    <td>${formatMoney(r.refund_amount || 0)}</td>
                    <td>${safeHtml(r.reason || "")}</td>
                    <td>${new Date(r.date).toLocaleString()}</td>
                </tr>
            `;
        });
    }
};

window.exportDailyClosingExcel = async function () {
    const date = getClosingDate();

    const res = await fetch(API + "/daily-closing?date=" + encodeURIComponent(date));
    const data = await res.json();

    let csv = "Daily Closing Report\n";
    csv += `Closing Date,${data.date}\n`;
    csv += `Exported At,${new Date().toLocaleString()}\n\n`;

    csv += `Sales,${Number(data.total_sales || 0).toFixed(2)}\n`;
    csv += `Profit,${Number(data.total_profit || 0).toFixed(2)}\n`;
    csv += `Expenses,${Number(data.total_expenses || 0).toFixed(2)}\n`;
    csv += `Refunds,${Number(data.total_refunds || 0).toFixed(2)}\n`;
    csv += `Net Profit,${Number(data.net_profit || 0).toFixed(2)}\n`;
    csv += `Transactions,${data.total_transactions || 0}\n`;
    csv += `Returns Count,${data.total_returns || 0}\n\n`;

    csv += "Expenses\n";
    csv += "ID,Category,Amount,Notes,Date\n";

    (data.expenses || []).forEach(e => {
        csv += `${e.id},${e.category},${Number(e.amount || 0).toFixed(2)},${e.notes || ""},${new Date(e.date).toLocaleString()}\n`;
    });

    csv += "\nCustomer Returns / Refunds\n";
    csv += "ID,Customer,Product,Barcode,Branch,Qty,Refund,Reason,Date\n";

    (data.returns || []).forEach(r => {
        csv += `${r.id},${r.customer_name || "Walk-in Customer"},${r.product_name},${r.barcode},${r.branch_name},${r.qty},${Number(r.refund_amount || 0).toFixed(2)},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "daily_closing_" + data.date + ".csv");
};

// CURRENCY SETTINGS
window.loadCurrencySettings = async function () {
    const res = await fetch(API + "/currency-settings");
    const settings = await res.json();

    if (settings.error) {
        alert(settings.error);
        return;
    }

    const currencySelect = document.getElementById("defaultCurrency");
    const rateInput = document.getElementById("usdToLbpRate");
    const table = document.getElementById("currencySettingsTable");

    if (currencySelect) currencySelect.value = settings.default_currency || "USD";
    if (rateInput) rateInput.value = settings.usd_to_lbp_rate || 89500;

    if (table) {
        table.innerHTML = `
            <tr>
                <td>${settings.default_currency || "USD"}</td>
                <td>${Number(settings.usd_to_lbp_rate || 89500).toLocaleString()}</td>
            </tr>
        `;
    }
};

window.saveCurrencySettings = async function () {
    const default_currency = document.getElementById("defaultCurrency").value;
    const usd_to_lbp_rate = Number(document.getElementById("usdToLbpRate").value);

    if (!default_currency || usd_to_lbp_rate <= 0) {
        alert("Please select currency and enter valid exchange rate");
        return;
    }

    const res = await fetch(API + "/currency-settings", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            default_currency,
            usd_to_lbp_rate
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    await window.loadSystemCurrency();
    loadCurrencySettings();

    if (typeof loadDashboard === "function") loadDashboard();
    if (typeof loadBranchDashboard === "function") loadBranchDashboard();
    if (typeof displayCart === "function") displayCart();
};

// INVOICES
window.loadInvoices = async function () {
    const res = await fetch(API + "/invoices");
    const invoices = await res.json();

    displayInvoices(invoices);
};

window.displayInvoices = function (invoices) {
    const table = document.getElementById("invoicesTable");
    if (!table) return;

    table.innerHTML = "";

    invoices.forEach(inv => {
        table.innerHTML += `
            <tr>
                <td>${inv.id}</td>
                <td>${safeHtml(inv.invoice_no)}</td>
                <td>${safeHtml(inv.customer_name || "Walk-in Customer")}</td>
                <td>${safeHtml(inv.customer_phone || "")}</td>
                <td>${safeHtml(inv.branch_name || "")}</td>
                <td>${safeHtml(inv.cashier_name || "")}</td>
                <td>${safeHtml(inv.payment_method || "Cash")}</td>
                <td>${formatMoney(inv.total || 0)}</td>
                <td>${new Date(inv.date).toLocaleString()}</td>
                <td><button onclick="reprintInvoice(${inv.id})">Reprint</button></td>
            </tr>
        `;
    });
};

window.searchInvoices = async function () {
    const search = document.getElementById("invoiceSearch").value.toLowerCase();
    const dateFrom = document.getElementById("invoiceDateFrom").value;
    const dateTo = document.getElementById("invoiceDateTo").value;

    const res = await fetch(API + "/invoices");
    const invoices = await res.json();

    const filtered = invoices.filter(inv => {
        const textMatch =
            String(inv.invoice_no || "").toLowerCase().includes(search) ||
            String(inv.customer_name || "").toLowerCase().includes(search) ||
            String(inv.customer_phone || "").toLowerCase().includes(search) ||
            String(inv.branch_name || "").toLowerCase().includes(search) ||
            String(inv.cashier_name || "").toLowerCase().includes(search);

        const invoiceDate = new Date(inv.date);

        let fromMatch = true;
        let toMatch = true;

        if (dateFrom) {
            const fromDate = new Date(dateFrom + "T00:00:00");
            fromMatch = invoiceDate >= fromDate;
        }

        if (dateTo) {
            const toDate = new Date(dateTo + "T23:59:59");
            toMatch = invoiceDate <= toDate;
        }

        return textMatch && fromMatch && toMatch;
    });

    displayInvoices(filtered);
};

window.clearInvoiceFilters = function () {
    document.getElementById("invoiceSearch").value = "";
    document.getElementById("invoiceDateFrom").value = "";
    document.getElementById("invoiceDateTo").value = "";

    loadInvoices();
};

window.reprintInvoice = async function (invoiceId) {
    const res = await fetch(API + "/invoices/" + invoiceId);
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    printSavedInvoice(data.invoice, data.items);
};

window.printSavedInvoice = function (invoice, items) {
    let rows = "";
    let total = 0;

    items.forEach(item => {
        total += Number(item.line_total || 0);

        rows += `
            <tr>
                <td>${safeHtml(item.product_name)}</td>
                <td>${safeHtml(item.barcode)}</td>
                <td>${item.qty}</td>
                <td>${formatMoney(item.unit_price || 0)}</td>
                <td>${formatMoney(item.line_total || 0)}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>${safeHtml(invoice.invoice_no)}</title>
            <style>
                @page { size: A4; margin: 12mm; }
                body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 0; background: white; }
                .invoice { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111827; padding-bottom: 15px; margin-bottom: 20px; }
                .company { display: flex; align-items: center; gap: 15px; }
                .company img { width: 75px; height: 75px; object-fit: contain; }
                .company h1 { margin: 0; font-size: 24px; color: #111827; }
                .company p { margin: 3px 0; font-size: 13px; color: #4b5563; }
                .invoice-title { text-align: right; }
                .invoice-title h2 { margin: 0; font-size: 28px; color: #111827; }
                .invoice-title p { margin: 5px 0; font-size: 14px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
                .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
                .info-box h3 { margin: 0 0 8px 0; font-size: 15px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
                .info-box p { margin: 5px 0; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background: #111827; color: white; padding: 10px; font-size: 14px; border: 1px solid #111827; }
                td { padding: 10px; font-size: 14px; border: 1px solid #d1d5db; text-align: center; }
                td:first-child { text-align: left; }
                .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
                .totals-box { width: 300px; border: 1px solid #111827; }
                .totals-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #d1d5db; font-size: 15px; }
                .totals-row:last-child { border-bottom: none; background: #111827; color: white; font-size: 18px; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .invoice { border: none; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <div class="company">
                        <img src="logo.png" alt="Logo">
                        <div>
                            <h1>Mart & Wholesales</h1>
                            <p>Beirut, Lebanon</p>
                            <p>Phone: +961 3 743 351</p>
                            <p>Email: martwholesales@gmail.com</p>
                        </div>
                    </div>

                    <div class="invoice-title">
                        <h2>INVOICE</h2>
                        <p><strong>No:</strong> ${safeHtml(invoice.invoice_no)}</p>
                        <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleString()}</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-box">
                        <h3>Customer Information</h3>
                        <p><strong>Customer:</strong> ${safeHtml(invoice.customer_name || "Walk-in Customer")}</p>
                        <p><strong>Phone:</strong> ${safeHtml(invoice.customer_phone || "")}</p>
                    </div>

                    <div class="info-box">
                        <h3>Sale Information</h3>
                        <p><strong>Branch:</strong> ${safeHtml(invoice.branch_name || "")}</p>
                        <p><strong>Cashier:</strong> ${safeHtml(invoice.cashier_name || "")}</p>
                        <p><strong>Payment:</strong> ${safeHtml(invoice.payment_method || "Cash")}</p>
                        <p><strong>Currency:</strong> ${systemCurrency}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Barcode</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>

                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row">
                            <span>Subtotal</span>
                            <span>${formatMoney(total)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Discount</span>
                            <span>${formatMoney(0)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Grand Total</span>
                            <span>${formatMoney(invoice.total || total)}</span>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    Thank you for your business<br>
                    Reprinted from saved invoice record.
                </div>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};
// DAILY CLOSING
window.getClosingDate = function () {
    const input = document.getElementById("closingDateInput");

    if (input && input.value) {
        return input.value;
    }

    return new Date().toISOString().slice(0, 10);
};

window.loadDailyClosing = async function () {
    const date = getClosingDate();

    const dateInput = document.getElementById("closingDateInput");
    if (dateInput && !dateInput.value) {
        dateInput.value = date;
    }

    const res = await fetch(API + "/daily-closing?date=" + encodeURIComponent(date));
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    setText("closingSelectedDate", data.date);
    setText("closingSales", formatMoney(data.total_sales || 0));
    setText("closingProfit", formatMoney(data.total_profit || 0));
    setText("closingExpenses", formatMoney(data.total_expenses || 0));
    setText("closingRefunds", formatMoney(data.total_refunds || 0));
    setText("closingNetProfit", formatMoney(data.net_profit || 0));
    setText("closingTransactions", data.total_transactions || 0);
    setText("closingReturnsCount", data.total_returns || 0);

    const expensesTable = document.getElementById("closingExpensesTable");
    if (expensesTable) {
        expensesTable.innerHTML = "";

        (data.expenses || []).forEach(e => {
            expensesTable.innerHTML += `
                <tr>
                    <td>${e.id}</td>
                    <td>${safeHtml(e.category)}</td>
                    <td>${formatMoney(e.amount || 0)}</td>
                    <td>${safeHtml(e.notes || "")}</td>
                    <td>${new Date(e.date).toLocaleString()}</td>
                </tr>
            `;
        });
    }

    const returnsTable = document.getElementById("closingReturnsTable");
    if (returnsTable) {
        returnsTable.innerHTML = "";

        (data.returns || []).forEach(r => {
            returnsTable.innerHTML += `
                <tr>
                    <td>${r.id}</td>
                    <td>${safeHtml(r.customer_name || "Walk-in Customer")}</td>
                    <td>${safeHtml(r.product_name)}</td>
                    <td>${safeHtml(r.barcode)}</td>
                    <td>${safeHtml(r.branch_name)}</td>
                    <td>${r.qty}</td>
                    <td>${formatMoney(r.refund_amount || 0)}</td>
                    <td>${safeHtml(r.reason || "")}</td>
                    <td>${new Date(r.date).toLocaleString()}</td>
                </tr>
            `;
        });
    }
};

window.printDailyClosing = async function () {
    const date = getClosingDate();

    const res = await fetch(API + "/daily-closing?date=" + encodeURIComponent(date));
    const data = await res.json();

    let expenseRows = "";
    let returnRows = "";

    (data.expenses || []).forEach(e => {
        expenseRows += `
            <tr>
                <td>${e.id}</td>
                <td>${safeHtml(e.category)}</td>
                <td>${formatMoney(e.amount || 0)}</td>
                <td>${safeHtml(e.notes || "")}</td>
                <td>${new Date(e.date).toLocaleString()}</td>
            </tr>
        `;
    });

    (data.returns || []).forEach(r => {
        returnRows += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.customer_name || "Walk-in Customer")}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.refund_amount || 0)}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Daily Closing Report - ${safeHtml(data.date)}</title>
            <style>
                ${reportHeaderCss()}

                body { 
                    font-family: Arial; 
                    padding: 20px; 
                    color: #111827;
                }

                .closing-date {
                    font-size: 15px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }

                .summary {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-top: 20px;
                    margin-bottom: 25px;
                }

                .card {
                    border: 1px solid #111827;
                    padding: 12px;
                    font-size: 16px;
                    font-weight: bold;
                    background: #f9fafb;
                }

                h2 {
                    margin-top: 25px;
                    border-bottom: 2px solid #111827;
                    padding-bottom: 6px;
                }

                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 15px; 
                    font-size: 13px;
                }

                th, td { 
                    border: 1px solid #000; 
                    padding: 8px; 
                    text-align: center; 
                }

                th { 
                    background: #111827; 
                    color: white;
                }

                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>

        <body>
            ${reportHeaderHtml("Daily Closing Report")}

            <div class="closing-date">
                Closing Date: ${safeHtml(data.date)}
            </div>

            <div class="summary">
                <div class="card">Sales: ${formatMoney(data.total_sales || 0)}</div>
                <div class="card">Profit: ${formatMoney(data.total_profit || 0)}</div>
                <div class="card">Expenses: ${formatMoney(data.total_expenses || 0)}</div>
                <div class="card">Refunds: ${formatMoney(data.total_refunds || 0)}</div>
                <div class="card">Net Profit: ${formatMoney(data.net_profit || 0)}</div>
                <div class="card">Transactions: ${data.total_transactions || 0}</div>
                <div class="card">Returns Count: ${data.total_returns || 0}</div>
            </div>

            <h2>Expenses</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Notes</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${expenseRows}</tbody>
            </table>

            <h2>Customer Returns / Refunds</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Branch</th>
                        <th>Qty</th>
                        <th>Refund</th>
                        <th>Reason</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${returnRows}</tbody>
            </table>

            <script>
                setTimeout(() => window.print(), 500);
            </script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportDailyClosingExcel = async function () {
    const date = getClosingDate();

    const res = await fetch(API + "/daily-closing?date=" + encodeURIComponent(date));
    const data = await res.json();

    let csv = "Daily Closing Report\n";
    csv += `Closing Date,${data.date}\n`;
    csv += `Exported At,${new Date().toLocaleString()}\n\n`;

    csv += `Sales,${Number(data.total_sales || 0).toFixed(2)}\n`;
    csv += `Profit,${Number(data.total_profit || 0).toFixed(2)}\n`;
    csv += `Expenses,${Number(data.total_expenses || 0).toFixed(2)}\n`;
    csv += `Refunds,${Number(data.total_refunds || 0).toFixed(2)}\n`;
    csv += `Net Profit,${Number(data.net_profit || 0).toFixed(2)}\n`;
    csv += `Transactions,${data.total_transactions || 0}\n`;
    csv += `Returns Count,${data.total_returns || 0}\n\n`;

    csv += "Expenses\n";
    csv += "ID,Category,Amount,Notes,Date\n";

    (data.expenses || []).forEach(e => {
        csv += `${e.id},${e.category},${Number(e.amount || 0).toFixed(2)},${e.notes || ""},${new Date(e.date).toLocaleString()}\n`;
    });

    csv += "\nCustomer Returns / Refunds\n";
    csv += "ID,Customer,Product,Barcode,Branch,Qty,Refund,Reason,Date\n";

    (data.returns || []).forEach(r => {
        csv += `${r.id},${r.customer_name || "Walk-in Customer"},${r.product_name},${r.barcode},${r.branch_name},${r.qty},${Number(r.refund_amount || 0).toFixed(2)},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "daily_closing_" + data.date + ".csv");
};

// CURRENCY SETTINGS
window.loadCurrencySettings = async function () {
    const res = await fetch(API + "/currency-settings");
    const settings = await res.json();

    if (settings.error) {
        alert(settings.error);
        return;
    }

    const currencySelect = document.getElementById("defaultCurrency");
    const rateInput = document.getElementById("usdToLbpRate");
    const table = document.getElementById("currencySettingsTable");

    if (currencySelect) currencySelect.value = settings.default_currency || "USD";
    if (rateInput) rateInput.value = settings.usd_to_lbp_rate || 89500;

    if (table) {
        table.innerHTML = `
            <tr>
                <td>${settings.default_currency || "USD"}</td>
                <td>${Number(settings.usd_to_lbp_rate || 89500).toLocaleString()}</td>
            </tr>
        `;
    }
};

window.saveCurrencySettings = async function () {
    const default_currency = document.getElementById("defaultCurrency").value;
    const usd_to_lbp_rate = Number(document.getElementById("usdToLbpRate").value);

    if (!default_currency || usd_to_lbp_rate <= 0) {
        alert("Please select currency and enter valid exchange rate");
        return;
    }

    const res = await fetch(API + "/currency-settings", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            default_currency,
            usd_to_lbp_rate
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    await window.loadSystemCurrency();
    loadCurrencySettings();

    if (typeof loadDashboard === "function") loadDashboard();
    if (typeof loadBranchDashboard === "function") loadBranchDashboard();
    if (typeof displayCart === "function") displayCart();
};

// INVOICES
window.loadInvoices = async function () {
    const res = await fetch(API + "/invoices");
    const invoices = await res.json();

    displayInvoices(invoices);
};

window.displayInvoices = function (invoices) {
    const table = document.getElementById("invoicesTable");
    if (!table) return;

    table.innerHTML = "";

    invoices.forEach(inv => {
        table.innerHTML += `
            <tr>
                <td>${inv.id}</td>
                <td>${safeHtml(inv.invoice_no)}</td>
                <td>${safeHtml(inv.customer_name || "Walk-in Customer")}</td>
                <td>${safeHtml(inv.customer_phone || "")}</td>
                <td>${safeHtml(inv.branch_name || "")}</td>
                <td>${safeHtml(inv.cashier_name || "")}</td>
                <td>${safeHtml(inv.payment_method || "Cash")}</td>
                <td>${formatMoney(inv.total || 0)}</td>
                <td>${new Date(inv.date).toLocaleString()}</td>
                <td><button onclick="reprintInvoice(${inv.id})">Reprint</button></td>
            </tr>
        `;
    });
};

window.searchInvoices = async function () {
    const search = document.getElementById("invoiceSearch").value.toLowerCase();
    const dateFrom = document.getElementById("invoiceDateFrom").value;
    const dateTo = document.getElementById("invoiceDateTo").value;

    const res = await fetch(API + "/invoices");
    const invoices = await res.json();

    const filtered = invoices.filter(inv => {
        const textMatch =
            String(inv.invoice_no || "").toLowerCase().includes(search) ||
            String(inv.customer_name || "").toLowerCase().includes(search) ||
            String(inv.customer_phone || "").toLowerCase().includes(search) ||
            String(inv.branch_name || "").toLowerCase().includes(search) ||
            String(inv.cashier_name || "").toLowerCase().includes(search);

        const invoiceDate = new Date(inv.date);

        let fromMatch = true;
        let toMatch = true;

        if (dateFrom) {
            const fromDate = new Date(dateFrom + "T00:00:00");
            fromMatch = invoiceDate >= fromDate;
        }

        if (dateTo) {
            const toDate = new Date(dateTo + "T23:59:59");
            toMatch = invoiceDate <= toDate;
        }

        return textMatch && fromMatch && toMatch;
    });

    displayInvoices(filtered);
};

window.clearInvoiceFilters = function () {
    document.getElementById("invoiceSearch").value = "";
    document.getElementById("invoiceDateFrom").value = "";
    document.getElementById("invoiceDateTo").value = "";

    loadInvoices();
};

window.reprintInvoice = async function (invoiceId) {
    const res = await fetch(API + "/invoices/" + invoiceId);
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    printSavedInvoice(data.invoice, data.items);
};

window.printSavedInvoice = function (invoice, items) {
    let rows = "";
    let total = 0;

    items.forEach(item => {
        total += Number(item.line_total || 0);

        rows += `
            <tr>
                <td>${safeHtml(item.product_name)}</td>
                <td>${safeHtml(item.barcode)}</td>
                <td>${item.qty}</td>
                <td>${formatMoney(item.unit_price || 0)}</td>
                <td>${formatMoney(item.line_total || 0)}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>${safeHtml(invoice.invoice_no)}</title>
            <style>
                @page { size: A4; margin: 12mm; }
                body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 0; background: white; }
                .invoice { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #111827; padding-bottom: 15px; margin-bottom: 20px; }
                .company { display: flex; align-items: center; gap: 15px; }
                .company img { width: 75px; height: 75px; object-fit: contain; }
                .company h1 { margin: 0; font-size: 24px; color: #111827; }
                .company p { margin: 3px 0; font-size: 13px; color: #4b5563; }
                .invoice-title { text-align: right; }
                .invoice-title h2 { margin: 0; font-size: 28px; color: #111827; }
                .invoice-title p { margin: 5px 0; font-size: 14px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
                .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
                .info-box h3 { margin: 0 0 8px 0; font-size: 15px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
                .info-box p { margin: 5px 0; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th { background: #111827; color: white; padding: 10px; font-size: 14px; border: 1px solid #111827; }
                td { padding: 10px; font-size: 14px; border: 1px solid #d1d5db; text-align: center; }
                td:first-child { text-align: left; }
                .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
                .totals-box { width: 300px; border: 1px solid #111827; }
                .totals-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #d1d5db; font-size: 15px; }
                .totals-row:last-child { border-bottom: none; background: #111827; color: white; font-size: 18px; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .invoice { border: none; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <div class="company">
                        <img src="logo.png" alt="Logo">
                        <div>
                            <h1>Mart & Wholesales</h1>
                            <p>Beirut, Lebanon</p>
                            <p>Phone: +961 3 743 351</p>
                            <p>Email: martwholesales@gmail.com</p>
                        </div>
                    </div>

                    <div class="invoice-title">
                        <h2>INVOICE</h2>
                        <p><strong>No:</strong> ${safeHtml(invoice.invoice_no)}</p>
                        <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleString()}</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-box">
                        <h3>Customer Information</h3>
                        <p><strong>Customer:</strong> ${safeHtml(invoice.customer_name || "Walk-in Customer")}</p>
                        <p><strong>Phone:</strong> ${safeHtml(invoice.customer_phone || "")}</p>
                    </div>

                    <div class="info-box">
                        <h3>Sale Information</h3>
                        <p><strong>Branch:</strong> ${safeHtml(invoice.branch_name || "")}</p>
                        <p><strong>Cashier:</strong> ${safeHtml(invoice.cashier_name || "")}</p>
                        <p><strong>Payment:</strong> ${safeHtml(invoice.payment_method || "Cash")}</p>
                        <p><strong>Currency:</strong> ${systemCurrency}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Barcode</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>

                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row">
                            <span>Subtotal</span>
                            <span>${formatMoney(total)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Discount</span>
                            <span>${formatMoney(0)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Grand Total</span>
                            <span>${formatMoney(invoice.total || total)}</span>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    Thank you for your business<br>
                    Reprinted from saved invoice record.
                </div>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};
// CUSTOMER RETURNS
window.loadCustomerReturnOptions = async function () {
    const customersRes = await fetch(API + "/customers");
    const customers = await customersRes.json();

    const invoicesRes = await fetch(API + "/invoices");
    const invoices = await invoicesRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const customerSelect = document.getElementById("returnCustomer");
    const invoiceSelect = document.getElementById("returnInvoice");
    const productSelect = document.getElementById("returnCustomerProduct");
    const branchSelect = document.getElementById("returnCustomerBranch");

    if (customerSelect) {
        customerSelect.innerHTML = `<option value="">Walk-in Customer</option>`;
        customers.forEach(c => {
            customerSelect.innerHTML += `<option value="${c.id}">${safeHtml(c.name)} - ${safeHtml(c.phone)}</option>`;
        });
    }

    if (invoiceSelect) {
        invoiceSelect.innerHTML = `<option value="">No Invoice Selected</option>`;
        invoices.forEach(i => {
            invoiceSelect.innerHTML += `
                <option value="${i.id}">
                    ${safeHtml(i.invoice_no)} - ${safeHtml(i.customer_name || "Walk-in")} - ${formatMoney(i.total || 0)}
                </option>
            `;
        });
    }

    if (productSelect) {
        productSelect.innerHTML = "";
        products.forEach(p => {
            productSelect.innerHTML += `
                <option 
                    value="${p.id}" 
                    data-unit-price="${p.price || 0}"
                    data-sold-qty="0"
                >
                    ${safeHtml(p.name)} - ${safeHtml(p.barcode)}
                </option>
            `;
        });
    }

    if (branchSelect) {
        branchSelect.innerHTML = "";
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        });
    }

    calculateCustomerRefund();
};

window.loadReturnInvoiceItems = async function () {
    const invoiceId = document.getElementById("returnInvoice")?.value;
    const productSelect = document.getElementById("returnCustomerProduct");

    if (!productSelect) return;

    if (!invoiceId) {
        const productsRes = await fetch(API + "/products");
        const products = await productsRes.json();

        productSelect.innerHTML = "";

        products.forEach(p => {
            productSelect.innerHTML += `
                <option 
                    value="${p.id}" 
                    data-unit-price="${p.price || 0}"
                    data-sold-qty="0"
                >
                    ${safeHtml(p.name)} - ${safeHtml(p.barcode)}
                </option>
            `;
        });

        const refundInput = document.getElementById("customerRefundAmount");
        if (refundInput) refundInput.value = "";

        calculateCustomerRefund();
        return;
    }

    const res = await fetch(API + "/invoice-items/" + invoiceId);
    const items = await res.json();

    productSelect.innerHTML = "";

    items.forEach(item => {
        productSelect.innerHTML += `
            <option 
                value="${item.product_id}" 
                data-unit-price="${item.unit_price}"
                data-sold-qty="${item.qty}"
            >
                ${safeHtml(item.product_name)} - ${safeHtml(item.barcode)} - Sold Qty: ${item.qty} - Price: ${formatMoney(item.unit_price)}
            </option>
        `;
    });

    calculateCustomerRefund();
};

window.calculateCustomerRefund = function () {
    const productSelect = document.getElementById("returnCustomerProduct");
    const qtyInput = document.getElementById("customerReturnQty");
    const refundInput = document.getElementById("customerRefundAmount");

    if (!productSelect || !qtyInput || !refundInput) return;

    const selectedOption = productSelect.options[productSelect.selectedIndex];

    if (!selectedOption) {
        refundInput.value = "";
        return;
    }

    const unitPrice = Number(selectedOption.getAttribute("data-unit-price") || 0);
    const qty = Number(qtyInput.value || 0);

    refundInput.value = (unitPrice * qty).toFixed(2);
};

window.saveCustomerReturn = async function () {
    const customer_id = document.getElementById("returnCustomer").value;
    const invoice_id = document.getElementById("returnInvoice").value;
    const product_id = document.getElementById("returnCustomerProduct").value;
    const branch_id = document.getElementById("returnCustomerBranch").value;
    const qty = Number(document.getElementById("customerReturnQty").value);
    const reason = document.getElementById("customerReturnReason").value.trim();

    if (!product_id || !branch_id || qty <= 0) {
        alert("Please select product, branch, and valid return quantity");
        return;
    }

    const productSelect = document.getElementById("returnCustomerProduct");
    const selectedOption = productSelect.options[productSelect.selectedIndex];

    const soldQty = Number(selectedOption?.getAttribute("data-sold-qty") || 0);

    if (invoice_id && soldQty > 0 && qty > soldQty) {
        alert("Return quantity cannot exceed sold quantity in selected invoice");
        return;
    }

    const res = await fetch(API + "/customer-returns", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            customer_id: customer_id || null,
            invoice_id: invoice_id || null,
            product_id,
            branch_id,
            qty,
            reason
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("customerReturnQty").value = "";
    document.getElementById("customerRefundAmount").value = "";
    document.getElementById("customerReturnReason").value = "";

    loadCustomerReturns();
    loadProducts();
    loadDashboard();

    if (typeof loadBranchStock === "function") loadBranchStock();
    if (typeof loadBranchDashboard === "function") loadBranchDashboard();
};

window.loadCustomerReturns = async function () {
    const res = await fetch(API + "/customer-returns");
    const returns = await res.json();

    const table = document.getElementById("customerReturnsTable");
    if (!table) return;

    table.innerHTML = "";

    returns.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.customer_name || "Walk-in Customer")}</td>
                <td>${safeHtml(r.customer_phone || "")}</td>
                <td>${safeHtml(r.invoice_no || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.refund_amount || 0)}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });
};

window.printCustomerReturns = async function () {
    const res = await fetch(API + "/customer-returns");
    const returns = await res.json();

    let rows = "";

    returns.forEach(r => {
        rows += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.customer_name || "Walk-in Customer")}</td>
                <td>${safeHtml(r.customer_phone || "")}</td>
                <td>${safeHtml(r.invoice_no || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.refund_amount || 0)}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Customer Returns Report</title>
            <style>
                ${reportHeaderCss()}
                body { font-family: Arial; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            ${reportHeaderHtml("Customer Returns Report")}

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Invoice</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>UOM</th>
                        <th>Branch</th>
                        <th>Qty</th>
                        <th>Refund</th>
                        <th>Reason</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportCustomerReturnsExcel = async function () {
    const res = await fetch(API + "/customer-returns");
    const returns = await res.json();

    let csv = "ID,Customer,Phone,Invoice,Product,Barcode,UOM,Branch,Qty,Refund,Reason,Date\n";

    returns.forEach(r => {
        csv += `${r.id},${r.customer_name || "Walk-in Customer"},${r.customer_phone || ""},${r.invoice_no || ""},${r.product_name || ""},${r.barcode || ""},${r.uom || "PCS"},${r.branch_name || ""},${r.qty},${Number(r.refund_amount || 0).toFixed(2)},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "customer_returns_report.csv");
};

// SUPPLIER HISTORY
window.loadHistorySupplierOptions = async function () {
    const res = await fetch(API + "/suppliers");
    const suppliers = await res.json();

    const select = document.getElementById("historySupplier");
    if (!select) return;

    select.innerHTML = "";

    suppliers.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${safeHtml(s.name)}</option>`;
    });
};

window.loadSupplierHistory = async function () {
    const supplierId = document.getElementById("historySupplier").value;

    if (!supplierId) {
        alert("Please select supplier");
        return;
    }

    const res = await fetch(API + "/supplier-history/" + supplierId);
    const rows = await res.json();

    const table = document.getElementById("supplierHistoryTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.po_no || ("PO-" + r.id))}</td>
                <td>${safeHtml(r.supplier_name || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${r.received_qty || 0}</td>
                <td>${r.remaining_qty || 0}</td>
                <td>${safeHtml(r.status || "")}</td>
                <td>${safeHtml(r.cancel_reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });
};

window.printSupplierHistory = async function () {
    const supplierId = document.getElementById("historySupplier").value;

    if (!supplierId) {
        alert("Please select supplier");
        return;
    }

    const res = await fetch(API + "/supplier-history/" + supplierId);
    const rows = await res.json();

    let htmlRows = "";

    rows.forEach(r => {
        htmlRows += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.po_no || ("PO-" + r.id))}</td>
                <td>${safeHtml(r.supplier_name || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${r.received_qty || 0}</td>
                <td>${r.remaining_qty || 0}</td>
                <td>${safeHtml(r.status || "")}</td>
                <td>${safeHtml(r.cancel_reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    openReportWindow("Supplier Purchase History", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>PO No</th>
                    <th>Supplier</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>UOM</th>
                    <th>Branch</th>
                    <th>Ordered Qty</th>
                    <th>Received Qty</th>
                    <th>Remaining Qty</th>
                    <th>Status</th>
                    <th>Cancel Reason</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
        </table>
    `);
};

window.exportSupplierHistoryExcel = async function () {
    const supplierId = document.getElementById("historySupplier").value;

    if (!supplierId) {
        alert("Please select supplier");
        return;
    }

    const res = await fetch(API + "/supplier-history/" + supplierId);
    const rows = await res.json();

    let csv = "ID,PO No,Supplier,Product,Barcode,UOM,Branch,Ordered Qty,Received Qty,Remaining Qty,Status,Cancel Reason,Date\n";

    rows.forEach(r => {
        csv += `${r.id},${r.po_no || ("PO-" + r.id)},${r.supplier_name || ""},${r.product_name || ""},${r.barcode || ""},${r.uom || "PCS"},${r.branch_name || ""},${r.qty},${r.received_qty || 0},${r.remaining_qty || 0},${r.status || ""},${r.cancel_reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "supplier_purchase_history.csv");
};

// SUPPLIER RETURNS
window.loadSupplierReturnOptions = async function () {
    const suppliersRes = await fetch(API + "/suppliers");
    const suppliers = await suppliersRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const supplierSelect = document.getElementById("returnSupplier");
    const productSelect = document.getElementById("returnProduct");
    const branchSelect = document.getElementById("returnBranch");

    if (!supplierSelect || !productSelect || !branchSelect) return;

    supplierSelect.innerHTML = "";
    productSelect.innerHTML = "";
    branchSelect.innerHTML = "";

    suppliers.forEach(s => {
        supplierSelect.innerHTML += `<option value="${s.id}">${safeHtml(s.name)}</option>`;
    });

    products.forEach(p => {
        productSelect.innerHTML += `<option value="${p.id}">${safeHtml(p.name)} - ${safeHtml(p.barcode)}</option>`;
    });

    branches.forEach(b => {
        branchSelect.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
    });
};

window.returnToSupplier = async function () {
    const supplier_id = document.getElementById("returnSupplier").value;
    const product_id = document.getElementById("returnProduct").value;
    const branch_id = document.getElementById("returnBranch").value;
    const qty = Number(document.getElementById("returnQty").value);
    const reason = document.getElementById("returnReason").value.trim();

    if (!supplier_id || !product_id || !branch_id || qty <= 0) {
        alert("Please select supplier/product/branch and valid quantity");
        return;
    }

    const res = await fetch(API + "/supplier-returns", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            supplier_id,
            product_id,
            branch_id,
            qty,
            reason
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("returnQty").value = "";
    document.getElementById("returnReason").value = "";

    loadSupplierReturns();
    loadProducts();
    loadDashboard();

    if (typeof loadBranchStock === "function") loadBranchStock();
    if (typeof loadBranchDashboard === "function") loadBranchDashboard();
};

window.loadSupplierReturns = async function () {
    const res = await fetch(API + "/supplier-returns");
    const returns = await res.json();

    const table = document.getElementById("supplierReturnsTable");
    if (!table) return;

    table.innerHTML = "";

    returns.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.supplier_name || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });
};

window.printSupplierReturns = async function () {
    const res = await fetch(API + "/supplier-returns");
    const returns = await res.json();

    let rows = "";

    returns.forEach(r => {
        rows += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.supplier_name || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    openReportWindow("Supplier Returns Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Supplier</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>UOM</th>
                    <th>Branch</th>
                    <th>Qty</th>
                    <th>Reason</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};

window.exportSupplierReturnsExcel = async function () {
    const res = await fetch(API + "/supplier-returns");
    const returns = await res.json();

    let csv = "ID,Supplier,Product,Barcode,UOM,Branch,Qty,Reason,Date\n";

    returns.forEach(r => {
        csv += `${r.id},${r.supplier_name || ""},${r.product_name || ""},${r.barcode || ""},${r.uom || "PCS"},${r.branch_name || ""},${r.qty},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "supplier_returns_report.csv");
};

// PURCHASE CONTROL REPORTS
window.loadPurchaseControlOptions = async function () {
    const suppliersRes = await fetch(API + "/suppliers");
    const suppliers = await suppliersRes.json();

    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const poSupplier = document.getElementById("poReportSupplier");
    const poBranch = document.getElementById("poReportBranch");
    const returnSupplier = document.getElementById("returnReportSupplier");
    const returnBranch = document.getElementById("returnReportBranch");

    if (poSupplier) poSupplier.innerHTML = `<option value="">All Suppliers</option>`;
    if (returnSupplier) returnSupplier.innerHTML = `<option value="">All Suppliers</option>`;

    if (poBranch) poBranch.innerHTML = `<option value="">All Branches</option>`;
    if (returnBranch) returnBranch.innerHTML = `<option value="">All Branches</option>`;

    suppliers.forEach(s => {
        if (poSupplier) poSupplier.innerHTML += `<option value="${s.id}">${safeHtml(s.name)}</option>`;
        if (returnSupplier) returnSupplier.innerHTML += `<option value="${s.id}">${safeHtml(s.name)}</option>`;
    });

    branches.forEach(b => {
        if (poBranch) poBranch.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        if (returnBranch) returnBranch.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
    });
};

window.getPOReportQuery = function () {
    const status = document.getElementById("poReportStatus").value;
    const supplier = document.getElementById("poReportSupplier").value;
    const branch = document.getElementById("poReportBranch").value;

    const params = new URLSearchParams();

    if (status) params.append("status", status);
    if (supplier) params.append("supplier_id", supplier);
    if (branch) params.append("branch_id", branch);

    return params.toString();
};

window.loadFilteredPOReport = async function () {
    const query = getPOReportQuery();

    const res = await fetch(API + "/purchase-orders-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    const table = document.getElementById("filteredPOReportTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(o => {
        table.innerHTML += `
            <tr>
                <td>${o.id}</td>
                <td>${safeHtml(o.po_no || ("PO-" + o.id))}</td>
                <td>${safeHtml(o.supplier_name || "")}</td>
                <td>${safeHtml(o.product_name || "")}</td>
                <td>${safeHtml(o.barcode || "")}</td>
                <td>${safeHtml(o.uom || "PCS")}</td>
                <td>${safeHtml(o.branch_name || "")}</td>
                <td>${o.qty}</td>
                <td>${o.received_qty || 0}</td>
                <td>${o.remaining_qty || 0}</td>
                <td>${safeHtml(o.status || "")}</td>
                <td>${safeHtml(o.cancel_reason || "")}</td>
                <td>${new Date(o.date).toLocaleString()}</td>
            </tr>
        `;
    });
};

window.printFilteredPOReport = async function () {
    const query = getPOReportQuery();

    const res = await fetch(API + "/purchase-orders-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    let htmlRows = "";

    rows.forEach(o => {
        htmlRows += `
            <tr>
                <td>${o.id}</td>
                <td>${safeHtml(o.po_no || ("PO-" + o.id))}</td>
                <td>${safeHtml(o.supplier_name || "")}</td>
                <td>${safeHtml(o.product_name || "")}</td>
                <td>${safeHtml(o.barcode || "")}</td>
                <td>${safeHtml(o.uom || "PCS")}</td>
                <td>${safeHtml(o.branch_name || "")}</td>
                <td>${o.qty}</td>
                <td>${o.received_qty || 0}</td>
                <td>${o.remaining_qty || 0}</td>
                <td>${safeHtml(o.status || "")}</td>
                <td>${safeHtml(o.cancel_reason || "")}</td>
                <td>${new Date(o.date).toLocaleString()}</td>
            </tr>
        `;
    });

    openReportWindow("Filtered Purchase Order Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>PO No</th>
                    <th>Supplier</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>UOM</th>
                    <th>Branch</th>
                    <th>Ordered Qty</th>
                    <th>Received Qty</th>
                    <th>Remaining Qty</th>
                    <th>Status</th>
                    <th>Cancel Reason</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
        </table>
    `);
};

window.exportFilteredPOReportExcel = async function () {
    const query = getPOReportQuery();

    const res = await fetch(API + "/purchase-orders-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    let csv = "ID,PO No,Supplier,Product,Barcode,UOM,Branch,Ordered Qty,Received Qty,Remaining Qty,Status,Cancel Reason,Date\n";

    rows.forEach(o => {
        csv += `${o.id},${o.po_no || ("PO-" + o.id)},${o.supplier_name || ""},${o.product_name || ""},${o.barcode || ""},${o.uom || "PCS"},${o.branch_name || ""},${o.qty},${o.received_qty || 0},${o.remaining_qty || 0},${o.status || ""},${o.cancel_reason || ""},${new Date(o.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "filtered_purchase_order_report.csv");
};

window.getReturnsReportQuery = function () {
    const supplier = document.getElementById("returnReportSupplier").value;
    const branch = document.getElementById("returnReportBranch").value;

    const params = new URLSearchParams();

    if (supplier) params.append("supplier_id", supplier);
    if (branch) params.append("branch_id", branch);

    return params.toString();
};

window.loadFilteredReturnsReport = async function () {
    const query = getReturnsReportQuery();

    const res = await fetch(API + "/supplier-returns-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    const table = document.getElementById("filteredReturnsReportTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.supplier_name || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });
};

window.printFilteredReturnsReport = async function () {
    const query = getReturnsReportQuery();

    const res = await fetch(API + "/supplier-returns-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    let htmlRows = "";

    rows.forEach(r => {
        htmlRows += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.supplier_name || "")}</td>
                <td>${safeHtml(r.product_name || "")}</td>
                <td>${safeHtml(r.barcode || "")}</td>
                <td>${safeHtml(r.uom || "PCS")}</td>
                <td>${safeHtml(r.branch_name || "")}</td>
                <td>${r.qty}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    openReportWindow("Filtered Supplier Returns Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Supplier</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>UOM</th>
                    <th>Branch</th>
                    <th>Qty</th>
                    <th>Reason</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
        </table>
    `);
};

window.exportFilteredReturnsExcel = async function () {
    const query = getReturnsReportQuery();

    const res = await fetch(API + "/supplier-returns-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    let csv = "ID,Supplier,Product,Barcode,UOM,Branch,Qty,Reason,Date\n";

    rows.forEach(r => {
        csv += `${r.id},${r.supplier_name || ""},${r.product_name || ""},${r.barcode || ""},${r.uom || "PCS"},${r.branch_name || ""},${r.qty},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "filtered_supplier_returns_report.csv");
};

// SUPPLIER BALANCE
window.loadSupplierBalanceReport = async function () {
    const res = await fetch(API + "/supplier-balance-report");
    const rows = await res.json();

    const table = document.getElementById("supplierBalanceTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${safeHtml(r.supplier_name)}</td>
                <td>${r.total_received_qty}</td>
                <td>${formatMoney(r.total_received_value || 0)}</td>
                <td>${r.total_returned_qty}</td>
                <td>${formatMoney(r.total_returned_value || 0)}</td>
                <td>${r.net_qty}</td>
                <td>${formatMoney(r.net_value || 0)}</td>
            </tr>
        `;
    });
};

window.printSupplierBalanceReport = async function () {
    const res = await fetch(API + "/supplier-balance-report");
    const rows = await res.json();

    let htmlRows = "";

    rows.forEach(r => {
        htmlRows += `
            <tr>
                <td>${safeHtml(r.supplier_name)}</td>
                <td>${r.total_received_qty}</td>
                <td>${formatMoney(r.total_received_value || 0)}</td>
                <td>${r.total_returned_qty}</td>
                <td>${formatMoney(r.total_returned_value || 0)}</td>
                <td>${r.net_qty}</td>
                <td>${formatMoney(r.net_value || 0)}</td>
            </tr>
        `;
    });

    openReportWindow("Supplier Balance / Net Purchase Report", `
        <p><strong>Currency:</strong> ${systemCurrency}</p>
        <table>
            <thead>
                <tr>
                    <th>Supplier</th>
                    <th>Received Qty</th>
                    <th>Received Value</th>
                    <th>Returned Qty</th>
                    <th>Returned Value</th>
                    <th>Net Qty</th>
                    <th>Net Value</th>
                </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
        </table>
    `);
};

window.exportSupplierBalanceExcel = async function () {
    const res = await fetch(API + "/supplier-balance-report");
    const rows = await res.json();

    let csv = "Supplier,Received Qty,Received Value,Returned Qty,Returned Value,Net Qty,Net Value\n";

    rows.forEach(r => {
        csv += `${r.supplier_name},${r.total_received_qty},${Number(r.total_received_value || 0).toFixed(2)},${r.total_returned_qty},${Number(r.total_returned_value || 0).toFixed(2)},${r.net_qty},${Number(r.net_value || 0).toFixed(2)}\n`;
    });

    downloadCsv(csv, "supplier_balance_report.csv");
};

// PURCHASE ORDER REPORT
window.printPurchaseOrderReport = async function () {
    const res = await fetch(API + "/purchase-orders-report");
    const orders = await res.json();

    let rows = "";

    orders.forEach(o => {
        rows += `
            <tr>
                <td>${o.id}</td>
                <td>${safeHtml(o.po_no || ("PO-" + o.id))}</td>
                <td>${safeHtml(o.supplier_name || "")}</td>
                <td>${safeHtml(o.product_name || "")}</td>
                <td>${safeHtml(o.barcode || "")}</td>
                <td>${safeHtml(o.uom || "PCS")}</td>
                <td>${safeHtml(o.branch_name || "")}</td>
                <td>${o.qty}</td>
                <td>${o.received_qty || 0}</td>
                <td>${o.remaining_qty || 0}</td>
                <td>${safeHtml(o.status || "")}</td>
                <td>${safeHtml(o.cancel_reason || "")}</td>
                <td>${new Date(o.date).toLocaleString()}</td>
            </tr>
        `;
    });

    openReportWindow("Purchase Order Report", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>PO No</th>
                    <th>Supplier</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>UOM</th>
                    <th>Branch</th>
                    <th>Ordered Qty</th>
                    <th>Received Qty</th>
                    <th>Remaining Qty</th>
                    <th>Status</th>
                    <th>Cancel Reason</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};

window.exportPurchaseOrderExcel = async function () {
    const res = await fetch(API + "/purchase-orders-report");
    const orders = await res.json();

    let csv = "ID,PO No,Supplier,Product,Barcode,UOM,Branch,Ordered Qty,Received Qty,Remaining Qty,Status,Cancel Reason,Date\n";

    orders.forEach(o => {
        csv += `${o.id},${o.po_no || ("PO-" + o.id)},${o.supplier_name || ""},${o.product_name || ""},${o.barcode || ""},${o.uom || "PCS"},${o.branch_name || ""},${o.qty},${o.received_qty || 0},${o.remaining_qty || 0},${o.status || ""},${o.cancel_reason || ""},${new Date(o.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "purchase_order_report.csv");
};

// STOCK CONTROL
window.loadStockControlOptions = async function () {
    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const branchSelect = document.getElementById("adjustBranch");
    const productSelect = document.getElementById("adjustProduct");

    if (!branchSelect || !productSelect) return;

    branchSelect.innerHTML = "";
    productSelect.innerHTML = "";

    branches.forEach(b => {
        branchSelect.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
    });

    products.forEach(p => {
        productSelect.innerHTML += `<option value="${p.id}">${safeHtml(p.name)} - ${safeHtml(p.barcode)}</option>`;
    });
};

window.saveStockAdjustment = async function () {
    const branch_id = document.getElementById("adjustBranch").value;
    const product_id = document.getElementById("adjustProduct").value;
    const adjustment_type = document.getElementById("adjustmentType").value;
    const qty = Number(document.getElementById("adjustQty").value);
    const reason = document.getElementById("adjustReason").value;
    const notes = document.getElementById("adjustNotes").value.trim();

    if (!branch_id || !product_id || !adjustment_type || qty <= 0) {
        alert("Please select branch/product/type and enter valid quantity");
        return;
    }

    const fullReason = notes ? `${reason} - ${notes}` : reason;

    const res = await fetch(API + "/stock-adjustments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            branch_id,
            product_id,
            adjustment_type,
            qty,
            reason: fullReason
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("adjustQty").value = "";
    document.getElementById("adjustNotes").value = "";

    loadStockAdjustments();
    loadStockAdjustmentReport();
    loadProducts();
    loadDashboard();

    if (typeof loadBranchStock === "function") loadBranchStock();
    if (typeof loadBranchDashboard === "function") loadBranchDashboard();
};

window.loadStockAdjustments = async function () {
    const res = await fetch(API + "/stock-adjustments");
    const rows = await res.json();

    const table = document.getElementById("stockAdjustmentsTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${safeHtml(r.adjustment_type)}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.unit_cost || 0)}</td>
                <td>${formatMoney(r.total_cost_value || 0)}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${safeHtml(r.username || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });
};
// STOCK ADJUSTMENT REPORT
window.loadStockAdjustmentReportOptions = async function () {
    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const branchSelect = document.getElementById("adjustReportBranch");
    const productSelect = document.getElementById("adjustReportProduct");

    if (branchSelect) {
        branchSelect.innerHTML = `<option value="">All Branches</option>`;
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        });
    }

    if (productSelect) {
        productSelect.innerHTML = `<option value="">All Products</option>`;
        products.forEach(p => {
            productSelect.innerHTML += `<option value="${p.id}">${safeHtml(p.name)} - ${safeHtml(p.barcode)}</option>`;
        });
    }
};

window.getStockAdjustmentReportQuery = function () {
    const branch = document.getElementById("adjustReportBranch").value;
    const product = document.getElementById("adjustReportProduct").value;
    const type = document.getElementById("adjustReportType").value;
    const dateFrom = document.getElementById("adjustReportDateFrom").value;
    const dateTo = document.getElementById("adjustReportDateTo").value;

    const params = new URLSearchParams();

    if (branch) params.append("branch_id", branch);
    if (product) params.append("product_id", product);
    if (type) params.append("adjustment_type", type);
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);

    return params.toString();
};

window.loadStockAdjustmentReport = async function () {
    const query = getStockAdjustmentReportQuery();

    const res = await fetch(API + "/stock-adjustments-report" + (query ? "?" + query : ""));
    const rows = await res.json();

    const table = document.getElementById("stockAdjustmentReportTable");
    if (!table) return;

    table.innerHTML = "";

    let totalValue = 0;

    rows.forEach(r => {
        totalValue += Number(r.total_cost_value || 0);

        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${safeHtml(r.adjustment_type)}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.unit_cost || 0)}</td>
                <td>${formatMoney(r.total_cost_value || 0)}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${safeHtml(r.username || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    setText("adjustReportTotalValue", formatMoney(totalValue));
};

window.printStockAdjustmentReport = async function () {
    const query = getStockAdjustmentReportQuery();

    const res = await fetch(API + "/stock-adjustments-report" + (query ? "?" + query : ""));
    const rows = await res.json();

    let htmlRows = "";
    let totalValue = 0;

    rows.forEach(r => {
        totalValue += Number(r.total_cost_value || 0);

        htmlRows += `
            <tr>
                <td>${r.id}</td>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${safeHtml(r.adjustment_type)}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.unit_cost || 0)}</td>
                <td>${formatMoney(r.total_cost_value || 0)}</td>
                <td>${safeHtml(r.reason || "")}</td>
                <td>${safeHtml(r.username || "")}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Stock Adjustment Report</title>
            <style>
            ${reportHeaderCss()}
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th, td { border: 1px solid #000; padding: 6px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
        ${reportHeaderHtml("Stock Adjustment Report")}
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Currency:</strong> ${systemCurrency}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Branch</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>Total Cost Value</th>
                        <th>Reason</th>
                        <th>User</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${htmlRows}</tbody>
            </table>

            <div class="total">Total Cost Value: ${formatMoney(totalValue)}</div>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportStockAdjustmentReportExcel = async function () {
    const query = getStockAdjustmentReportQuery();

    const res = await fetch(API + "/stock-adjustments-report" + (query ? "?" + query : ""));
    const rows = await res.json();

    let csv = "ID,Branch,Product,Barcode,Type,Qty,Unit Cost,Total Cost Value,Reason,User,Date\n";

    rows.forEach(r => {
        csv += `${r.id},${r.branch_name},${r.product_name},${r.barcode},${r.adjustment_type},${r.qty},${Number(r.unit_cost || 0).toFixed(2)},${Number(r.total_cost_value || 0).toFixed(2)},${r.reason || ""},${r.username || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    downloadCsv(csv, "stock_adjustment_report.csv");
};

window.clearStockAdjustmentReportFilters = function () {
    document.getElementById("adjustReportBranch").value = "";
    document.getElementById("adjustReportProduct").value = "";
    document.getElementById("adjustReportType").value = "";
    document.getElementById("adjustReportDateFrom").value = "";
    document.getElementById("adjustReportDateTo").value = "";

    loadStockAdjustmentReport();
};

// MIN STOCK / LOW STOCK
window.loadMinStockOptions = async function () {
    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const minBranch = document.getElementById("minStockBranch");
    const minProduct = document.getElementById("minStockProduct");
    const lowBranch = document.getElementById("lowStockBranchFilter");

    if (minBranch) {
        minBranch.innerHTML = "";
        branches.forEach(b => {
            minBranch.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        });
    }

    if (minProduct) {
        minProduct.innerHTML = "";
        products.forEach(p => {
            minProduct.innerHTML += `<option value="${p.id}">${safeHtml(p.name)} - ${safeHtml(p.barcode)}</option>`;
        });
    }

    if (lowBranch) {
        lowBranch.innerHTML = `<option value="">All Branches</option>`;
        branches.forEach(b => {
            lowBranch.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        });
    }
};

window.saveMinStock = async function () {
    const branch_id = document.getElementById("minStockBranch").value;
    const product_id = document.getElementById("minStockProduct").value;
    const min_stock = Number(document.getElementById("minStockQty").value);

    if (!branch_id || !product_id || min_stock < 0) {
        alert("Please select branch/product and valid minimum stock");
        return;
    }

    const res = await fetch(API + "/branch-stock/min-stock", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            branch_id,
            product_id,
            min_stock
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("minStockQty").value = "";

    if (typeof loadBranchStock === "function") loadBranchStock();

    loadLowStockBranchReport();
    loadReorderSuggestions();
};

window.getLowStockBranchQuery = function () {
    const branch = document.getElementById("lowStockBranchFilter").value;

    const params = new URLSearchParams();

    if (branch) params.append("branch_id", branch);

    return params.toString();
};

window.loadLowStockBranchReport = async function () {
    const query = getLowStockBranchQuery();

    const res = await fetch(API + "/low-stock-branch-report" + (query ? "?" + query : ""));
    const rows = await res.json();

    const table = document.getElementById("lowStockBranchReportTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.stock}</td>
                <td>${r.min_stock}</td>
                <td>${r.reorder_qty}</td>
            </tr>
        `;
    });
};

window.printLowStockBranchReport = async function () {
    const query = getLowStockBranchQuery();

    const res = await fetch(API + "/low-stock-branch-report" + (query ? "?" + query : ""));
    const rows = await res.json();

    let htmlRows = "";

    rows.forEach(r => {
        htmlRows += `
            <tr>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.stock}</td>
                <td>${r.min_stock}</td>
                <td>${r.reorder_qty}</td>
            </tr>
        `;
    });

    openReportWindow("Low Stock Alerts by Branch", `
        <table>
            <thead>
                <tr>
                    <th>Branch</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Current Stock</th>
                    <th>Min Stock</th>
                    <th>Suggested Reorder Qty</th>
                </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
        </table>
    `);
};

window.exportLowStockBranchReportExcel = async function () {
    const query = getLowStockBranchQuery();

    const res = await fetch(API + "/low-stock-branch-report" + (query ? "?" + query : ""));
    const rows = await res.json();

    let csv = "Branch,Product,Barcode,Current Stock,Min Stock,Suggested Reorder Qty\n";

    rows.forEach(r => {
        csv += `${r.branch_name},${r.product_name},${r.barcode},${r.stock},${r.min_stock},${r.reorder_qty}\n`;
    });

    downloadCsv(csv, "low_stock_branch_report.csv");
};
// REORDER SUGGESTIONS
window.loadReorderOptions = async function () {
    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const branchSelect = document.getElementById("reorderBranchFilter");

    if (branchSelect) {
        branchSelect.innerHTML = `<option value="">All Branches</option>`;

        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${safeHtml(b.name)}</option>`;
        });
    }
};

window.getReorderSuggestionsQuery = function () {
    const branch = document.getElementById("reorderBranchFilter").value;

    const params = new URLSearchParams();

    if (branch) params.append("branch_id", branch);

    return params.toString();
};

window.loadReorderSuggestions = async function () {
    const query = getReorderSuggestionsQuery();

    const res = await fetch(API + "/reorder-suggestions" + (query ? "?" + query : ""));
    const rows = await res.json();

    const suppliersRes = await fetch(API + "/suppliers");
    const suppliers = await suppliersRes.json();

    const table = document.getElementById("reorderSuggestionsTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach((r, index) => {
        const costValue = Number(r.cost || 0) * Number(r.suggested_qty || 0);

        const supplierOptions = suppliers.map(s => {
            return `<option value="${s.id}">${safeHtml(s.name)}</option>`;
        }).join("");

        table.innerHTML += `
            <tr>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.stock}</td>
                <td>${r.min_stock}</td>
                <td>
                    <input 
                        id="reorderQty_${index}" 
                        type="number" 
                        value="${r.suggested_qty}" 
                        min="1" 
                        style="width:80px;"
                    >
                </td>
                <td>${formatMoney(costValue)}</td>
                <td>
                    <select id="reorderSupplier_${index}">
                        ${supplierOptions}
                    </select>
                </td>
                <td>
                    <button onclick="createPOFromReorder(${index}, ${r.product_id}, ${r.branch_id})">
                        Create PO
                    </button>
                </td>
            </tr>
        `;
    });

    window.reorderSuggestionsCache = rows;
};

window.createPOFromReorder = async function (index, productId, branchId) {
    const supplier_id = document.getElementById("reorderSupplier_" + index).value;
    const qty = Number(document.getElementById("reorderQty_" + index).value);

    if (!supplier_id || qty <= 0) {
        alert("Please select supplier and valid quantity");
        return;
    }

    const res = await fetch(API + "/purchase-orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            supplier_id,
            product_id: productId,
            branch_id: branchId,
            qty
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    if (typeof loadPurchaseOrders === "function") {
        loadPurchaseOrders();
    }

    loadReorderSuggestions();
};

window.printReorderSuggestions = async function () {
    const query = getReorderSuggestionsQuery();

    const res = await fetch(API + "/reorder-suggestions" + (query ? "?" + query : ""));
    const rows = await res.json();

    let htmlRows = "";
    let totalCostValue = 0;

    rows.forEach(r => {
        const costValue = Number(r.cost || 0) * Number(r.suggested_qty || 0);
        totalCostValue += costValue;

        htmlRows += `
            <tr>
                <td>${safeHtml(r.branch_name)}</td>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.stock}</td>
                <td>${r.min_stock}</td>
                <td>${r.suggested_qty}</td>
                <td>${formatMoney(costValue)}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Reorder Suggestions</title>
            <style>
            ${reportHeaderCss()}
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
    ${reportHeaderHtml("Reorder Suggestions")}
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Currency:</strong> ${systemCurrency}</p>

            <table>
                <thead>
                    <tr>
                        <th>Branch</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Current Stock</th>
                        <th>Min Stock</th>
                        <th>Suggested Qty</th>
                        <th>Cost Value</th>
                    </tr>
                </thead>
                <tbody>${htmlRows}</tbody>
            </table>

            <div class="total">Total Suggested Cost Value: ${formatMoney(totalCostValue)}</div>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportReorderSuggestionsExcel = async function () {
    const query = getReorderSuggestionsQuery();

    const res = await fetch(API + "/reorder-suggestions" + (query ? "?" + query : ""));
    const rows = await res.json();

    let csv = "Branch,Product,Barcode,Current Stock,Min Stock,Suggested Qty,Unit Cost,Cost Value\n";

    rows.forEach(r => {
        const costValue = Number(r.cost || 0) * Number(r.suggested_qty || 0);

        csv += `${r.branch_name},${r.product_name},${r.barcode},${r.stock},${r.min_stock},${r.suggested_qty},${Number(r.cost || 0).toFixed(2)},${costValue.toFixed(2)}\n`;
    });

    downloadCsv(csv, "reorder_suggestions.csv");
};

// FINAL STOCK AUDIT
window.loadStockAuditReport = async function () {
    const res = await fetch(API + "/stock-audit-report");
    const rows = await res.json();

    const table = document.getElementById("stockAuditTable");
    if (!table) return;

    table.innerHTML = "";

    let totalDifferenceValue = 0;

    rows.forEach(r => {
        const diff = Number(r.difference || 0);
        const diffValue = Number(r.difference_value || 0);

        totalDifferenceValue += diffValue;

        const status = diff === 0 ? "OK" : "Mismatch";

        table.innerHTML += `
            <tr>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.product_stock}</td>
                <td>${r.branch_stock_total}</td>
                <td>${diff}</td>
                <td>${formatMoney(r.cost || 0)}</td>
                <td>${formatMoney(diffValue)}</td>
                <td>${status}</td>
            </tr>
        `;
    });

    setText("stockAuditTotalDifferenceValue", formatMoney(totalDifferenceValue));
};

window.printStockAuditReport = async function () {
    const res = await fetch(API + "/stock-audit-report");
    const rows = await res.json();

    let htmlRows = "";
    let totalDifferenceValue = 0;

    rows.forEach(r => {
        const diff = Number(r.difference || 0);
        const diffValue = Number(r.difference_value || 0);

        totalDifferenceValue += diffValue;

        const status = diff === 0 ? "OK" : "Mismatch";

        htmlRows += `
            <tr>
                <td>${safeHtml(r.product_name)}</td>
                <td>${safeHtml(r.barcode)}</td>
                <td>${r.product_stock}</td>
                <td>${r.branch_stock_total}</td>
                <td>${diff}</td>
                <td>${formatMoney(r.cost || 0)}</td>
                <td>${formatMoney(diffValue)}</td>
                <td>${status}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Final Stock Audit Report</title>
            <style>
            ${reportHeaderCss()}
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
    ${reportHeaderHtml("Final Stock Audit Report")}
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Currency:</strong> ${systemCurrency}</p>

            <table>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Product Stock</th>
                        <th>Branch Stock Total</th>
                        <th>Difference</th>
                        <th>Unit Cost</th>
                        <th>Difference Value</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${htmlRows}</tbody>
            </table>

            <div class="total">Total Difference Value: ${formatMoney(totalDifferenceValue)}</div>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportStockAuditReportExcel = async function () {
    const res = await fetch(API + "/stock-audit-report");
    const rows = await res.json();

    let csv = "Product,Barcode,Product Stock,Branch Stock Total,Difference,Unit Cost,Difference Value,Status\n";

    rows.forEach(r => {
        const diff = Number(r.difference || 0);
        const diffValue = Number(r.difference_value || 0);
        const status = diff === 0 ? "OK" : "Mismatch";

        csv += `${r.product_name},${r.barcode},${r.product_stock},${r.branch_stock_total},${diff},${Number(r.cost || 0).toFixed(2)},${diffValue.toFixed(2)},${status}\n`;
    });

    downloadCsv(csv, "final_stock_audit_report.csv");
};

window.syncProductStockFromBranches = async function () {
    if (!confirm("This will sync product total stock from branch stock totals. Continue?")) return;

    const res = await fetch(API + "/sync-product-stock-from-branches", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadStockAuditReport();

    if (typeof loadProducts === "function") loadProducts();
    if (typeof loadDashboard === "function") loadDashboard();
    if (typeof loadBranchDashboard === "function") loadBranchDashboard();
};
// FINAL SAFETY CHECKS
console.log("app.js loaded successfully");
console.log("Currency function:", typeof window.formatMoney);
console.log("Role permission function:", typeof window.applyRolePermissions);
window.saveProfitTransfer = async function () {
    const transfer_date = document.getElementById("profitTransferDate").value || new Date().toISOString().slice(0, 10);
    const amount = Number(document.getElementById("profitTransferAmount").value);
    const wallet_name = document.getElementById("profitWalletName").value || "Wish Money";
    const wallet_reference = document.getElementById("profitWalletReference").value.trim();
    const notes = document.getElementById("profitTransferNotes").value.trim();

    if (amount <= 0) {
        alert("Please enter valid transfer amount");
        return;
    }

    const res = await fetch(API + "/profit-transfers", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            transfer_date,
            amount,
            wallet_name,
            wallet_reference,
            notes,
            status: "Transferred"
        })
    });

    const data = await res.json();

    alert(data.message || data.error);

    document.getElementById("profitTransferAmount").value = "";
    document.getElementById("profitWalletReference").value = "";
    document.getElementById("profitTransferNotes").value = "";

    loadProfitTransfers();
};

window.loadProfitTransfers = async function () {
    const res = await fetch(API + "/profit-transfers", {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const rows = await res.json();

    const table = document.getElementById("profitTransfersTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${r.transfer_date}</td>
                <td>${formatMoney(r.amount || 0)}</td>
                <td>${safeHtml(r.wallet_name || "Wish Money")}</td>
                <td>${safeHtml(r.wallet_reference || "")}</td>
                <td>${safeHtml(r.status || "")}</td>
                <td>${safeHtml(r.notes || "")}</td>
                <td>${safeHtml(r.created_by || "")}</td>
            </tr>
        `;
    });
};

window.printProfitTransfers = async function () {
    const res = await fetch(API + "/profit-transfers", {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const rows = await res.json();

    let htmlRows = "";
    let total = 0;

    rows.forEach(r => {
        total += Number(r.amount || 0);

        htmlRows += `
            <tr>
                <td>${r.id}</td>
                <td>${r.transfer_date}</td>
                <td>${formatMoney(r.amount || 0)}</td>
                <td>${safeHtml(r.wallet_name || "Wish Money")}</td>
                <td>${safeHtml(r.wallet_reference || "")}</td>
                <td>${safeHtml(r.status || "")}</td>
                <td>${safeHtml(r.notes || "")}</td>
                <td>${safeHtml(r.created_by || "")}</td>
            </tr>
        `;
    });

    openReportWindow("Profit Transfers to E-wallet", `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Wallet</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Created By</th>
                </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
        </table>

        <div class="total">Total Transferred: ${formatMoney(total)}</div>
    `);
};

window.exportProfitTransfersExcel = async function () {
    const res = await fetch(API + "/profit-transfers", {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const rows = await res.json();

    let csv = "ID,Date,Amount,Wallet,Reference,Status,Notes,Created By\n";

    rows.forEach(r => {
        csv += `${r.id},${r.transfer_date},${Number(r.amount || 0).toFixed(2)},${r.wallet_name || "Wish Money"},${r.wallet_reference || ""},${r.status || ""},${r.notes || ""},${r.created_by || ""}\n`;
    });

    downloadCsv(csv, "profit_transfers_wish_money.csv");
};
window.fixPOCancelColumns = async function () {
    if (!confirm("Fix PO cancel columns? Run this only once.")) return;

    const res = await fetch(API + "/fix-po-cancel-columns", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadPurchaseOrders();
};
window.clearPOFilters = function () {
    const searchInput = document.getElementById("poSearchInput");
    const statusFilter = document.getElementById("poStatusFilter");

    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "";

    loadPurchaseOrders();
};
window.fixProductUOMColumn = async function () {
    if (!confirm("Fix Product UOM column? Run this only once.")) return;

    const res = await fetch(API + "/fix-product-uom-column", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + localStorage.getItem("token")
        }
    });

    const data = await res.json();

    alert((data.message || data.error) + "\nUpdated: " + (data.updated || 0));

    if (typeof loadProducts === "function") loadProducts();
};
