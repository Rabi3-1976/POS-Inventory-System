const API = "";

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

// AUTH
window.login = async function () {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        alert("Please enter username and password");
        return;
    }

    try {
        const data = await fetchJson("/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ username, password })
        });

        token = data.token;
        currentRole = data.role;

        localStorage.setItem("token", token);
        localStorage.setItem("role", currentRole);
        localStorage.setItem("username", username);
        applyRolePermissions();

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        const adminSection = document.getElementById("adminSection");
        if (adminSection) adminSection.style.display = currentRole === "admin" ? "block" : "none";

        const usersMenuBtn = document.getElementById("usersMenuBtn");
        if (usersMenuBtn) usersMenuBtn.style.display = currentRole === "admin" ? "block" : "none";

        if (currentRole === "cashier") {
                showPage("posPage");
}                   else if (currentRole === "warehouse") {
                        showPage("productsPage");
}                               else if (currentRole === "manager") {
                                    showPage("dashboardPage");
}                                   else {
                    showPage("dashboardPage");
}
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        alert(err.message || "Login failed");
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
    loadDailyClosing();
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
}

    if (pageId === "branchesPage") {
        loadBranches();
        loadBranchStockOptions();
        loadBranchStock();
        loadTransferOptions();
        loadStockTransfers();
    }
    if (pageId === "invoiceReportPage") {
        loadInvoices();
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
                    <td>${money(row.total_sales)}</td>
                    <td>${money(row.total_profit)}</td>
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
                <td>${safeHtml(p.name)}</td>
                <td>${safeHtml(p.barcode)}</td>
                <td>${money(p.price)}</td>
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

window.addProduct = async function () {
    const name = document.getElementById("pname").value.trim();
    const barcode = document.getElementById("barcode").value.trim();
    const price = Number(document.getElementById("price").value);
    const cost = Number(document.getElementById("cost").value);

    if (!name || !barcode || price <= 0) {
        alert("Please enter product name, barcode, and valid price");
        return;
    }

    try {
        const data = await fetchJson("/products", {
            method: "POST",
            headers: authHeaders({"Content-Type": "application/json"}),
            body: JSON.stringify({ name, barcode, price, cost })
        });

        alert(data.message || "Product added");

        document.getElementById("pname").value = "";
        document.getElementById("barcode").value = "";
        document.getElementById("price").value = "";
        document.getElementById("cost").value = "";

        loadProducts();
        loadDashboard();
    } catch (err) {
        alert(err.message);
    }
};

window.searchProduct = window.searchByBarcode = async function () {
    const barcode = (document.getElementById("barcodeSearchInput") || document.getElementById("searchBarcode")).value.trim();

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
        loadBranchStock();
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
        loadBranchStock();
        loadBranchDashboard();
    } catch (err) {
        alert(err.message);
    }
};

window.importProducts = async function () {
    const fileInput = document.getElementById("importFile");

    if (!fileInput.files.length) {
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
        ? customerSelect.options[customerSelect.selectedIndex].text: "Walk-in Customer";

        const existing = cart.find(item => Number(item.id) === Number(product.id) && Number(item.branch_id) === Number(branch_id));

        if (existing) {
            if (branchStock < existing.qty + qty) {
                alert("Not enough branch stock for total cart quantity");
                return;
            }

            existing.qty += qty;
        } else {
           cart.push({
                        id: product.id,
                        name: product.name,
                        barcode: product.barcode,
                        price: Number(product.price),
                        qty: qty,
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
        const lineTotal = item.price * item.qty;
        total += lineTotal;

        table.innerHTML += `
            <tr>
                <td>${safeHtml(item.name)}</td>
                <td>${safeHtml(item.barcode)}</td>
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

        if (typeof loadBranchStock === "function") {
            loadBranchStock();
        }

        if (typeof loadBranchDashboard === "function") {
            loadBranchDashboard();
        }

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
                <td>${item.name}</td>
                <td>${item.barcode}</td>
                <td>${item.qty}</td>
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
                @page {
                    size: A4;
                    margin: 12mm;
                }

                body {
                    font-family: Arial, sans-serif;
                    color: #111827;
                    margin: 0;
                    padding: 0;
                    background: white;
                }

                .invoice {
                    max-width: 800px;
                    margin: auto;
                    padding: 20px;
                    border: 1px solid #e5e7eb;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px solid #111827;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }

                .company {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .company img {
                    width: 75px;
                    height: 75px;
                    object-fit: contain;
                }

                .company h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #111827;
                }

                .company p {
                    margin: 3px 0;
                    font-size: 13px;
                    color: #4b5563;
                }

                .invoice-title {
                    text-align: right;
                }

                .invoice-title h2 {
                    margin: 0;
                    font-size: 28px;
                    color: #111827;
                }

                .invoice-title p {
                    margin: 5px 0;
                    font-size: 14px;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .info-box {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    background: #f9fafb;
                }

                .info-box h3 {
                    margin: 0 0 8px 0;
                    font-size: 15px;
                    color: #111827;
                    border-bottom: 1px solid #d1d5db;
                    padding-bottom: 5px;
                }

                .info-box p {
                    margin: 5px 0;
                    font-size: 14px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }

                th {
                    background: #111827;
                    color: white;
                    padding: 10px;
                    font-size: 14px;
                    border: 1px solid #111827;
                }

                td {
                    padding: 10px;
                    font-size: 14px;
                    border: 1px solid #d1d5db;
                    text-align: center;
                }

                td:first-child {
                    text-align: left;
                }

                .totals {
                    margin-top: 20px;
                    display: flex;
                    justify-content: flex-end;
                }

                .totals-box {
                    width: 300px;
                    border: 1px solid #111827;
                }

                .totals-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px;
                    border-bottom: 1px solid #d1d5db;
                    font-size: 15px;
                }

                .totals-row:last-child {
                    border-bottom: none;
                    background: #111827;
                    color: white;
                    font-size: 18px;
                    font-weight: bold;
                }

                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 13px;
                    color: #6b7280;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 15px;
                }

                .signature-area {
                    margin-top: 40px;
                    display: flex;
                    justify-content: space-between;
                    gap: 40px;
                }

                .signature {
                    flex: 1;
                    border-top: 1px solid #111827;
                    text-align: center;
                    padding-top: 8px;
                    font-size: 13px;
                }

                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .invoice {
                        border: none;
                        padding: 0;
                    }
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
                        <p><strong>Customer:</strong> ${customerName}</p>
                    </div>

                    <div class="info-box">
                        <h3>Sale Information</h3>
                        <p><strong>Branch:</strong> ${branchName}</p>
                        <p><strong>Cashier:</strong> ${cashier}</p>
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

                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row">
                            <span>Subtotal</span>
                            <span>${formatMoney(total)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Discount</span>
                            <span>$0.00</span>
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

            <script>
                window.print();
            </script>
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
        const mainBranch = branches.find(b => b.name.toLowerCase() === "main");

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

        const supplierSelect = document.getElementById("poSupplier");
        const productSelect = document.getElementById("poProduct");
        const branchSelect = document.getElementById("poBranch");

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
    } catch (err) {
        console.error("Supplier options error:", err);
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

window.loadPurchaseOrders = async function () {
    const res = await fetch(API + "/purchase-orders");
    const orders = await res.json();

    const table = document.getElementById("purchaseOrdersTable");
    if (!table) return;

    table.innerHTML = "";

    orders.forEach(o => {
        table.innerHTML += `
            <tr>
                <td>${o.id}</td>
                <td>${o.supplier_name}</td>
                <td>${o.product_name}</td>
                <td>${o.barcode}</td>
                <td>${o.branch_name || ""}</td>
                <td>${o.qty}</td>
                <td>${o.received_qty || 0}</td>
                <td>${o.remaining_qty || 0}</td>
                <td>${o.status}</td>
                <td>${new Date(o.date).toLocaleString()}</td>
                <td>
                    ${
                        o.status === "Received"
                        ? "Received"
                        : `<button onclick="receivePurchaseOrder(${o.id}, ${o.remaining_qty || o.qty})">Receive</button>`
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
};

// REPORTS
function openReportWindow(title, bodyHtml) {
    const reportWindow = window.open("", "_blank");

    reportWindow.document.write(`
        <html>
        <head>
            <title>${safeHtml(title)}</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>${safeHtml(title)}</h1>
            <p>Date: ${new Date().toLocaleString()}</p>
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
            <thead><tr><th>ID</th><th>Product</th><th>Barcode</th><th>Price</th><th>Stock</th></tr></thead>
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
            <thead><tr><th>ID</th><th>Product</th><th>Barcode</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Date</th></tr></thead>
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
            <thead><tr><th>ID</th><th>Product</th><th>Barcode</th><th>Qty</th><th>Date</th></tr></thead>
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
            <thead><tr>
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
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `);
};
window.exportInvoicesExcel = async function () {
    const res = await fetch(API + "/invoices");
    const invoices = await res.json();

    let csv = "ID,Invoice No,Customer,Phone,Branch,Cashier,Payment,Total,Date\n";

    invoices.forEach(inv => {
        csv += `${inv.id},${inv.invoice_no},${inv.customer_name || "Walk-in Customer"},${inv.customer_phone || ""},${inv.branch_name || ""},${inv.cashier_name || ""},${inv.payment_method || "Cash"},${Number(inv.total || 0).toFixed(2)},${new Date(inv.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "invoice_report.csv";
    link.click();
};
window.exportBranchSalesExcel = async function () {
    const sales = await fetchJson("/branch-sales-report");
    let csv = "ID,Branch,Customer,Phone,Product,Barcode,Qty,Unit Price,Total,Profit,Date\n";

    sales.forEach(s => {
        const unitPrice = Number(s.price) / Number(s.qty || 1);
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
            <thead><tr><th>ID</th><th>From Branch</th><th>To Branch</th><th>Product</th><th>Barcode</th><th>Qty</th><th>Date</th></tr></thead>
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
    await loadSystemCurrency();
    const savedToken = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");

    if (savedToken && savedRole) {
        token = savedToken;
        currentRole = savedRole;
        applyRolePermissions();

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        const adminSection = document.getElementById("adminSection");
        if (adminSection) adminSection.style.display = currentRole === "admin" ? "block" : "none";

        const usersMenuBtn = document.getElementById("usersMenuBtn");
        if (usersMenuBtn) usersMenuBtn.style.display = currentRole === "admin" ? "block" : "none";

        if (currentRole === "cashier") {
        showPage("posPage");
}           else if (currentRole === "warehouse") {
                showPage("productsPage");
}                   else if (currentRole === "manager") {
                        showPage("dashboardPage");
}                           else {
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
            if (e.key === "Enter") document.getElementById("receiveQty").focus();
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
});
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
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.email || ""}</td>
                <td>${c.address || ""}</td>
                <td>${c.date}</td>
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
                ${c.name} - ${c.phone}
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
                ${c.name} - ${c.phone}
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
                <td>${r.branch_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(unitPrice)}</td>
                <td>${formatMoney(total)}</td>
                <td>${formatMoney(profit)}</td>
                <td>${r.date}</td>
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

    let reportWindow = window.open("", "_blank");

    let html = `
        <html>
        <head>
            <title>Customer Purchase History</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Customer Purchase History</h1>
            <p><strong>Customer:</strong> ${selectedText}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

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
                <tbody>
    `;

    rows.forEach(r => {
        const unitPrice = Number(r.price) / Number(r.qty || 1);
        const total = Number(r.price || 0);
        const profit = Number(r.profit || 0);

        html += `
            <tr>
                <td>${r.id}</td>
                <td>${r.branch_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(unitPrice)}</td>
                <td>${formatMoney(total)}</td>
                <td>${formatMoney(profit)}</td>
                <td>${r.date}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
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

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "customer_purchase_history.csv";
    link.click();
};
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
                <td>${e.category}</td>
                <td>${formatMoney(e.amount || 0)}</td>
                <td>${e.notes || ""}</td>
                <td>${e.date}</td>
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

    let reportWindow = window.open("", "_blank");

    let total = 0;

    let rows = "";

    expenses.forEach(e => {
        total += Number(e.amount || 0);

        rows += `
            <tr>
                <td>${e.id}</td>
                <td>${e.category}</td>
                <td>${formatMoney(e.amount || 0)}</td>
                <td>${e.notes || ""}</td>
                <td>${e.date}</td>
            </tr>
        `;
    });

    const html = `
        <html>
        <head>
            <title>Expenses Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
                .total { font-size: 20px; font-weight: bold; margin-top: 20px; text-align: right; }
            </style>
        </head>
        <body>
            <h1>Expenses Report</h1>
            <p>Date: ${new Date().toLocaleString()}</p>

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
                <tbody>
                    ${rows}
                </tbody>
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

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "expenses_report.csv";
    link.click();
};
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

    const res = await fetch(API + "/daily-closing?date=" + date);
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

        data.expenses.forEach(e => {
            expensesTable.innerHTML += `
                <tr>
                    <td>${e.id}</td>
                    <td>${e.category}</td>
                    <td>${formatMoney(e.amount || 0)}</td>
                    <td>${e.notes || ""}</td>
                    <td>${new Date(e.date).toLocaleString()}</td>
                </tr>
            `;
        });
    }

    const returnsTable = document.getElementById("closingReturnsTable");
    if (returnsTable) {
        returnsTable.innerHTML = "";

        data.returns.forEach(r => {
            returnsTable.innerHTML += `
                <tr>
                    <td>${r.id}</td>
                    <td>${r.customer_name || "Walk-in Customer"}</td>
                    <td>${r.product_name}</td>
                    <td>${r.barcode}</td>
                    <td>${r.branch_name}</td>
                    <td>${r.qty}</td>
                    <td>${formatMoney(r.refund_amount || 0)}</td>
                    <td>${r.reason || ""}</td>
                    <td>${new Date(r.date).toLocaleString()}</td>
                </tr>
            `;
        });
    }
};
window.printDailyClosing = async function () {
    const date = getClosingDate();

    const res = await fetch(API + "/daily-closing?date=" + date);
    const data = await res.json();

    let expenseRows = "";
    let returnRows = "";

    data.expenses.forEach(e => {
        expenseRows += `
            <tr>
                <td>${e.id}</td>
                <td>${e.category}</td>
                <td>${formatMoney(e.amount || 0)}</td>
                <td>${e.notes || ""}</td>
                <td>${new Date(e.date).toLocaleString()}</td>
            </tr>
        `;
    });

    data.returns.forEach(r => {
        returnRows += `
            <tr>
                <td>${r.id}</td>
                <td>${r.customer_name || "Walk-in Customer"}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.refund_amount || 0)}</td>
                <td>${r.reason || ""}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Daily Closing Report - ${data.date}</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                .summary {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-top: 20px;
                }
                .card {
                    border: 1px solid #000;
                    padding: 12px;
                    font-size: 18px;
                    font-weight: bold;
                }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Daily Closing Report</h1>
            <p><strong>Closing Date:</strong> ${data.date}</p>
            <p><strong>Printed At:</strong> ${new Date().toLocaleString()}</p>

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

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};
window.exportDailyClosingExcel = async function () {
    const date = getClosingDate();

    const res = await fetch(API + "/daily-closing?date=" + date);
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

    data.expenses.forEach(e => {
        csv += `${e.id},${e.category},${Number(e.amount || 0).toFixed(2)},${e.notes || ""},${new Date(e.date).toLocaleString()}\n`;
    });

    csv += "\nCustomer Returns / Refunds\n";
    csv += "ID,Customer,Product,Barcode,Branch,Qty,Refund,Reason,Date\n";

    data.returns.forEach(r => {
        csv += `${r.id},${r.customer_name || "Walk-in Customer"},${r.product_name},${r.barcode},${r.branch_name},${r.qty},${Number(r.refund_amount || 0).toFixed(2)},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "daily_closing_" + data.date + ".csv";
    link.click();
};
window.applyRolePermissions = function () {
    const role = currentRole || localStorage.getItem("role");

    const allButtons = [
        "dashboardMenuBtn",
        "branchDashboardMenuBtn",
        "productsMenuBtn",
        "posMenuBtn",
        "receivingMenuBtn",
        "reportsMenuBtn",
        "invoiceReportMenuBtn",
        "customersMenuBtn",
        "customerReturnsMenuBtn",
        "expensesMenuBtn",
        "currencyMenuBtn",
        "closingMenuBtn",
        "branchesMenuBtn",
        "suppliersMenuBtn",
        "usersMenuBtn"
    ];

    allButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = "none";
    });

    const permissions = {
        admin: [
            "dashboardMenuBtn",
            "branchDashboardMenuBtn",
            "productsMenuBtn",
            "posMenuBtn",
            "receivingMenuBtn",
            "reportsMenuBtn",
            "invoiceReportMenuBtn",
            "customersMenuBtn",
            "customerReturnsMenuBtn",
            "expensesMenuBtn",
            "closingMenuBtn",
            "branchesMenuBtn",
            "suppliersMenuBtn",
            "usersMenuBtn",
            "currencyMenuBtn"
        ],

        cashier: [
            "posMenuBtn",
            "customersMenuBtn"
        ],

        warehouse: [
            "productsMenuBtn",
            "receivingMenuBtn",
            "branchesMenuBtn",
            "suppliersMenuBtn"
        ],

        manager: [
            "dashboardMenuBtn",
            "branchDashboardMenuBtn",
            "reportsMenuBtn",
            "invoiceReportMenuBtn",
            "customersMenuBtn",
            "customerReturnsMenuBtn",
            "expensesMenuBtn",
            "closingMenuBtn"
        ]
    };

    const allowed = permissions[role] || [];

    allowed.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = "block";
    });
};
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
                <td>${inv.invoice_no}</td>
                <td>${inv.customer_name || "Walk-in Customer"}</td>
                <td>${inv.customer_phone || ""}</td>
                <td>${inv.branch_name || ""}</td>
                <td>${inv.cashier_name || ""}</td>
                <td>${inv.payment_method || "Cash"}</td>
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
                <td>${item.product_name}</td>
                <td>${item.barcode}</td>
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
            <title>${invoice.invoice_no}</title>
            <style>
                @page {
                    size: A4;
                    margin: 12mm;
                }

                body {
                    font-family: Arial, sans-serif;
                    color: #111827;
                    margin: 0;
                    padding: 0;
                    background: white;
                }

                .invoice {
                    max-width: 800px;
                    margin: auto;
                    padding: 20px;
                    border: 1px solid #e5e7eb;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px solid #111827;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }

                .company {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .company img {
                    width: 75px;
                    height: 75px;
                    object-fit: contain;
                }

                .company h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #111827;
                }

                .company p {
                    margin: 3px 0;
                    font-size: 13px;
                    color: #4b5563;
                }

                .invoice-title {
                    text-align: right;
                }

                .invoice-title h2 {
                    margin: 0;
                    font-size: 28px;
                    color: #111827;
                }

                .invoice-title p {
                    margin: 5px 0;
                    font-size: 14px;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .info-box {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    background: #f9fafb;
                }

                .info-box h3 {
                    margin: 0 0 8px 0;
                    font-size: 15px;
                    border-bottom: 1px solid #d1d5db;
                    padding-bottom: 5px;
                }

                .info-box p {
                    margin: 5px 0;
                    font-size: 14px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }

                th {
                    background: #111827;
                    color: white;
                    padding: 10px;
                    font-size: 14px;
                    border: 1px solid #111827;
                }

                td {
                    padding: 10px;
                    font-size: 14px;
                    border: 1px solid #d1d5db;
                    text-align: center;
                }

                td:first-child {
                    text-align: left;
                }

                .totals {
                    margin-top: 20px;
                    display: flex;
                    justify-content: flex-end;
                }

                .totals-box {
                    width: 300px;
                    border: 1px solid #111827;
                }

                .totals-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px;
                    border-bottom: 1px solid #d1d5db;
                    font-size: 15px;
                }

                .totals-row:last-child {
                    border-bottom: none;
                    background: #111827;
                    color: white;
                    font-size: 18px;
                    font-weight: bold;
                }

                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 13px;
                    color: #6b7280;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 15px;
                }

                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .invoice {
                        border: none;
                        padding: 0;
                    }
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
                        <p><strong>No:</strong> ${invoice.invoice_no}</p>
                        <p><strong>Date:</strong> ${invoice.date}</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-box">
                        <h3>Customer Information</h3>
                        <p><strong>Customer:</strong> ${invoice.customer_name || "Walk-in Customer"}</p>
                        <p><strong>Phone:</strong> ${invoice.customer_phone || ""}</p>
                    </div>

                    <div class="info-box">
                        <h3>Sale Information</h3>
                        <p><strong>Branch:</strong> ${invoice.branch_name || ""}</p>
                        <p><strong>Cashier:</strong> ${invoice.cashier_name || ""}</p>
                        <p><strong>Payment:</strong> ${invoice.payment_method || "Cash"}</p>
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

                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row">
                            <span>Subtotal</span>
                            <span>${formatMoney(total)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Discount</span>
                            <span>$0.00</span>
                        </div>
                        <div class="totals-row">
                            <span>Grand Total</span>
                            <span>${formatMoney(Number(invoice.total || total))}</span>
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
window.printPurchaseOrderReport = async function () {
    const res = await fetch(API + "/purchase-orders-report");
    const orders = await res.json();

    let rows = "";

    orders.forEach(o => {
        rows += `
            <tr>
                <td>${o.id}</td>
                <td>${o.supplier_name}</td>
                <td>${o.product_name}</td>
                <td>${o.barcode}</td>
                <td>${o.branch_name || ""}</td>
                <td>${o.qty}</td>
                <td>${o.status}</td>
                <td>${new Date(o.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Purchase Order Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Purchase Order Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Branch</th>
                        <th>Qty</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportPurchaseOrderExcel = async function () {
    const res = await fetch(API + "/purchase-orders-report");
    const orders = await res.json();

    let csv = "ID,Supplier,Product,Barcode,Branch,Qty,Status,Date\n";

    orders.forEach(o => {
        csv += `${o.id},${o.supplier_name},${o.product_name},${o.barcode},${o.branch_name || ""},${o.qty},${o.status},${new Date(o.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "purchase_order_report.csv";
    link.click();
};
window.loadHistorySupplierOptions = async function () {
    const res = await fetch(API + "/suppliers");
    const suppliers = await res.json();

    const select = document.getElementById("historySupplier");
    if (!select) return;

    select.innerHTML = "";

    suppliers.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
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
                <td>${r.supplier_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name || ""}</td>
                <td>${r.qty}</td>
                <td>${r.status}</td>
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
                <td>${r.supplier_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name || ""}</td>
                <td>${r.qty}</td>
                <td>${r.status}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Supplier Purchase History</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Supplier Purchase History</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Branch</th>
                        <th>Qty</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlRows}
                </tbody>
            </table>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportSupplierHistoryExcel = async function () {
    const supplierId = document.getElementById("historySupplier").value;

    if (!supplierId) {
        alert("Please select supplier");
        return;
    }

    const res = await fetch(API + "/supplier-history/" + supplierId);
    const rows = await res.json();

    let csv = "ID,Supplier,Product,Barcode,Branch,Qty,Status,Date\n";

    rows.forEach(r => {
        csv += `${r.id},${r.supplier_name},${r.product_name},${r.barcode},${r.branch_name || ""},${r.qty},${r.status},${new Date(r.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "supplier_purchase_history.csv";
    link.click();
};
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
        supplierSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    products.forEach(p => {
        productSelect.innerHTML += `<option value="${p.id}">${p.name} - ${p.barcode}</option>`;
    });

    branches.forEach(b => {
        branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
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

    if (typeof loadBranchStock === "function") {
        loadBranchStock();
    }

    if (typeof loadBranchDashboard === "function") {
        loadBranchDashboard();
    }
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
                <td>${r.supplier_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name}</td>
                <td>${r.qty}</td>
                <td>${r.reason || ""}</td>
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
                <td>${r.supplier_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name}</td>
                <td>${r.qty}</td>
                <td>${r.reason || ""}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Supplier Returns Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Supplier Returns Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Branch</th>
                        <th>Qty</th>
                        <th>Reason</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportSupplierReturnsExcel = async function () {
    const res = await fetch(API + "/supplier-returns");
    const returns = await res.json();

    let csv = "ID,Supplier,Product,Barcode,Branch,Qty,Reason,Date\n";

    returns.forEach(r => {
        csv += `${r.id},${r.supplier_name},${r.product_name},${r.barcode},${r.branch_name},${r.qty},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "supplier_returns_report.csv";
    link.click();
};
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
        if (poSupplier) poSupplier.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        if (returnSupplier) returnSupplier.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    branches.forEach(b => {
        if (poBranch) poBranch.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        if (returnBranch) returnBranch.innerHTML += `<option value="${b.id}">${b.name}</option>`;
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
                <td>${o.supplier_name}</td>
                <td>${o.product_name}</td>
                <td>${o.barcode}</td>
                <td>${o.branch_name || ""}</td>
                <td>${o.qty}</td>
                <td>${o.status}</td>
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
                <td>${o.supplier_name}</td>
                <td>${o.product_name}</td>
                <td>${o.barcode}</td>
                <td>${o.branch_name || ""}</td>
                <td>${o.qty}</td>
                <td>${o.status}</td>
                <td>${new Date(o.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Filtered Purchase Order Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Filtered Purchase Order Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Branch</th>
                        <th>Qty</th>
                        <th>Status</th>
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

window.exportFilteredPOReportExcel = async function () {
    const query = getPOReportQuery();

    const res = await fetch(API + "/purchase-orders-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    let csv = "ID,Supplier,Product,Barcode,Branch,Qty,Status,Date\n";

    rows.forEach(o => {
        csv += `${o.id},${o.supplier_name},${o.product_name},${o.barcode},${o.branch_name || ""},${o.qty},${o.status},${new Date(o.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "filtered_purchase_order_report.csv";
    link.click();
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
                <td>${r.supplier_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name}</td>
                <td>${r.qty}</td>
                <td>${r.reason || ""}</td>
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
                <td>${r.supplier_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name}</td>
                <td>${r.qty}</td>
                <td>${r.reason || ""}</td>
                <td>${new Date(r.date).toLocaleString()}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Filtered Supplier Returns Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Filtered Supplier Returns Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Branch</th>
                        <th>Qty</th>
                        <th>Reason</th>
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

window.exportFilteredReturnsExcel = async function () {
    const query = getReturnsReportQuery();

    const res = await fetch(API + "/supplier-returns-filtered" + (query ? "?" + query : ""));
    const rows = await res.json();

    let csv = "ID,Supplier,Product,Barcode,Branch,Qty,Reason,Date\n";

    rows.forEach(r => {
        csv += `${r.id},${r.supplier_name},${r.product_name},${r.barcode},${r.branch_name},${r.qty},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "filtered_supplier_returns_report.csv";
    link.click();
};
window.loadSupplierBalanceReport = async function () {
    const res = await fetch(API + "/supplier-balance-report");
    const rows = await res.json();

    const table = document.getElementById("supplierBalanceTable");
    if (!table) return;

    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.supplier_name}</td>
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
                <td>${r.supplier_name}</td>
                <td>${r.total_received_qty}</td>
                <td>${formatMoney(r.total_received_value || 0)}</td>
                <td>${r.total_returned_qty}</td>
                <td>${formatMoney(r.total_returned_value || 0)}</td>
                <td>${r.net_qty}</td>
                <td>${formatMoney(r.net_value || 0)}</td>
            </tr>
        `;
    });

    const reportWindow = window.open("", "_blank");

    const html = `
        <html>
        <head>
            <title>Supplier Balance Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Supplier Balance / Net Purchase Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

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
                <tbody>
                    ${htmlRows}
                </tbody>
            </table>

            <script>window.print();</script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
};

window.exportSupplierBalanceExcel = async function () {
    const res = await fetch(API + "/supplier-balance-report");
    const rows = await res.json();

    let csv = "Supplier,Received Qty,Received Value,Returned Qty,Returned Value,Net Qty,Net Value\n";

    rows.forEach(r => {
        csv += `${r.supplier_name},${r.total_received_qty},${Number(r.total_received_value || 0).toFixed(2)},${r.total_returned_qty},${Number(r.total_returned_value || 0).toFixed(2)},${r.net_qty},${Number(r.net_value || 0).toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "supplier_balance_report.csv";
    link.click();
};
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
            customerSelect.innerHTML += `<option value="${c.id}">${c.name} - ${c.phone}</option>`;
        });
    }

    if (invoiceSelect) {
        invoiceSelect.innerHTML = `<option value="">No Invoice Selected</option>`;
        invoices.forEach(i => {
            invoiceSelect.innerHTML += `
                <option value="${i.id}">
                    ${i.invoice_no} - ${i.customer_name || "Walk-in"} - ${Number(i.total || 0).toFixed(2)}
                </option>
            `;
        });
    }

    if (productSelect) {
        productSelect.innerHTML = "";
        products.forEach(p => {
            productSelect.innerHTML += `<option value="${p.id}">${p.name} - ${p.barcode}</option>`;
        });
    }

    if (branchSelect) {
        branchSelect.innerHTML = "";
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    }
};

window.saveCustomerReturn = async function () {
    const customer_id = document.getElementById("returnCustomer").value;
    const invoice_id = document.getElementById("returnInvoice").value;
    const product_id = document.getElementById("returnCustomerProduct").value;
    const branch_id = document.getElementById("returnCustomerBranch").value;
    const qty = Number(document.getElementById("customerReturnQty").value);
    const refund_amount = Number(document.getElementById("customerRefundAmount").value || 0);
    const reason = document.getElementById("customerReturnReason").value.trim();

    if (!product_id || !branch_id || qty <= 0) {
        alert("Please select product, branch, and valid return quantity");
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
            refund_amount,
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

    if (typeof loadBranchStock === "function") {
        loadBranchStock();
    }

    if (typeof loadBranchDashboard === "function") {
        loadBranchDashboard();
    }
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
                <td>${r.customer_name || "Walk-in Customer"}</td>
                <td>${r.customer_phone || ""}</td>
                <td>${r.invoice_no || ""}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.refund_amount || 0)}</td>
                <td>${r.reason || ""}</td>
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
                <td>${r.customer_name || "Walk-in Customer"}</td>
                <td>${r.customer_phone || ""}</td>
                <td>${r.invoice_no || ""}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.branch_name}</td>
                <td>${r.qty}</td>
                <td>${formatMoney(r.refund_amount || 0)}</td>
                <td>${r.reason || ""}</td>
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
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Customer Returns Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Invoice</th>
                        <th>Product</th>
                        <th>Barcode</th>
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

    let csv = "ID,Customer,Phone,Invoice,Product,Barcode,Branch,Qty,Refund,Reason,Date\n";

    returns.forEach(r => {
        csv += `${r.id},${r.customer_name || "Walk-in Customer"},${r.customer_phone || ""},${r.invoice_no || ""},${r.product_name},${r.barcode},${r.branch_name},${r.qty},${Number(r.refund_amount || 0).toFixed(2)},${r.reason || ""},${new Date(r.date).toLocaleString()}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "customer_returns_report.csv";
    link.click();
};
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
        await loadSystemCurrency();
              loadCurrencySettings();
};
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