const API = "";

let token = "";
let currentRole = "";
let cart = [];
let branchesCache = [];
let salesProfitChart = null;
let stockChart = null;
let html5QrCode = null;

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

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        const adminSection = document.getElementById("adminSection");
        if (adminSection) adminSection.style.display = currentRole === "admin" ? "block" : "none";

        const usersMenuBtn = document.getElementById("usersMenuBtn");
        if (usersMenuBtn) usersMenuBtn.style.display = currentRole === "admin" ? "block" : "none";

        showPage("productsPage");
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        alert(err.message || "Login failed");
    }
};

window.logout = function () {
    localStorage.removeItem("token");
    localStorage.removeItem("role");

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
    if (pageId === "expensesPage") {
    loadExpenses();
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

    if (pageId === "receivingPage") {
        setTimeout(() => {
            const receiveBarcode = document.getElementById("receiveBarcode");
            if (receiveBarcode) receiveBarcode.focus();
        }, 100);
    }

    if (pageId === "suppliersPage") {
        loadSupplierOptions();
        loadPurchaseOrders();
    }

    if (pageId === "branchesPage") {
        loadBranches();
        loadBranchStockOptions();
        loadBranchStock();
        loadTransferOptions();
        loadStockTransfers();
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
        alert("Please enter username, password and role");
        return;
    }

    try {
        const data = await fetchJson("/create-user", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ username, password, role })
        });

        alert(data.message || "User created");
        document.getElementById("newUsername").value = "";
        document.getElementById("newPassword").value = "";
        loadUsers();
    } catch (err) {
        alert(err.message);
    }
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
        setText("totalSales", money(data.totalSales ?? data.total_sales));
        setText("lowStock", data.lowStock ?? data.low_stock ?? 0);
        setText("totalProfit", money(data.totalProfit ?? data.total_profit));
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
                <td>${money(item.price)}</td>
                <td>${money(lineTotal)}</td>
                <td><button onclick="removeFromCart(${index})">Remove</button></td>
            </tr>
        `;
    });

    totalBox.innerText = money(total);
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

    try {
        const customer_id = document.getElementById("saleCustomer")
            ? document.getElementById("saleCustomer").value
            : "";

        for (const item of cart) {
            const res = await fetch(API + "/branch-sale", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    branch_id: item.branch_id,
                    product_id: item.id,
                    qty: item.qty,
                    customer_id: customer_id || null
                })
            });

            const data = await res.json();

            if (data.error) {
                alert(data.error);
                return;
            }
        }

        printCartReceipt();

        alert("Sale completed successfully");

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

    } catch (err) {
        console.error("CHECKOUT ERROR:", err);
        alert("Checkout failed: " + err.message);
    }
};

window.printCartReceipt = function () {
    let receiptWindow = window.open("", "_blank");

    let total = 0;
    let rows = "";

    cart.forEach(item => {
        const lineTotal = item.price * item.qty;
        total += lineTotal;

        rows += `
            <tr>
                <td>${safeHtml(item.name)}</td>
                <td>${item.qty}</td>
                <td>${money(item.price)}</td>
                <td>${money(lineTotal)}</td>
            </tr>
        `;
    });

    const invoiceNumber = "INV-" + Date.now();
    const customerName = cart.length > 0 && cart[0].customer_name
    ? cart[0].customer_name
    : "Walk-in Customer";
    const html = `
        <html>
        <head>
            <title>Invoice</title>
            <style>
                body { font-family: Arial; padding: 20px; width: 420px; color: #222; }
                .header { text-align: center; margin-bottom: 20px; }
                .header img { width: 80px; height: 80px; object-fit: contain; }
                h1 { margin: 5px 0; }
                .company-info { font-size: 13px; color: #555; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: center; font-size: 14px; }
                th { background: #f2f2f2; }
                .total { text-align: right; margin-top: 20px; font-size: 20px; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; font-size: 13px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="logo.png">
                <h1>Your Company Name</h1>
                <div class="company-info">
                    Beirut, Lebanon<br>
                    Phone: +961 XX XXX XXX<br>
                    Email: info@company.com
                </div>
            </div>
            <hr>
            <p>
            <strong>Invoice:</strong> ${invoiceNumber}<br>
            <strong>Date:</strong> ${new Date().toLocaleString()}<br>
            <strong>Customer:</strong> ${customerName}
            </p>
            <table>
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="total">Grand Total: $${money(total)}</div>
            <div class="footer">Thank you for your business</div>
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
    try {
        const orders = await fetchJson("/purchase-orders");
        const table = document.getElementById("purchaseOrdersTable");

        if (!table) return;

        table.innerHTML = "";

        orders.forEach(o => {
            table.innerHTML += `
                <tr>
                    <td>${o.id}</td>
                    <td>${safeHtml(o.supplier_name)}</td>
                    <td>${safeHtml(o.product_name)}</td>
                    <td>${safeHtml(o.barcode)}</td>
                    <td>${safeHtml(o.branch_name || "")}</td>
                    <td>${o.qty}</td>
                    <td>${safeHtml(o.status)}</td>
                    <td>${safeHtml(o.date)}</td>
                    <td>${o.status === "Received" ? "Received" : `<button onclick="receivePurchaseOrder(${o.id})">Receive</button>`}</td>
                </tr>
            `;
        });
    } catch (err) {
        alert(err.message);
    }
};

window.receivePurchaseOrder = async function (id) {
    if (!confirm("Receive this purchase order and update stock in assigned branch?")) return;

    try {
        const data = await fetchJson("/purchase-orders/" + id + "/receive", {
            method: "PUT",
            headers: authHeaders()
        });

        alert(data.message || "Purchase order received");

        loadPurchaseOrders();
        loadProducts();
        loadDashboard();
        loadBranchStock();
        loadBranchStockOptions();
        loadBranchDashboard();
    } catch (err) {
        alert(err.message);
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
            <td>${money(p.price)}</td>
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
            <td>${money(Number(s.price) / Number(s.qty || 1))}</td>
            <td>${money(s.price)}</td>
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
                <td>${money(unitPrice)}</td>
                <td>${money(s.price)}</td>
                <td>${money(s.profit)}</td>
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
    const savedToken = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");

    if (savedToken && savedRole) {
        token = savedToken;
        currentRole = savedRole;

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        const adminSection = document.getElementById("adminSection");
        if (adminSection) adminSection.style.display = currentRole === "admin" ? "block" : "none";

        const usersMenuBtn = document.getElementById("usersMenuBtn");
        if (usersMenuBtn) usersMenuBtn.style.display = currentRole === "admin" ? "block" : "none";

        showPage("productsPage");
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
                <td>${unitPrice.toFixed(2)}</td>
                <td>${total.toFixed(2)}</td>
                <td>${profit.toFixed(2)}</td>
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
                <td>${unitPrice.toFixed(2)}</td>
                <td>${total.toFixed(2)}</td>
                <td>${profit.toFixed(2)}</td>
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
                <td>${Number(e.amount || 0).toFixed(2)}</td>
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
                <td>${Number(e.amount || 0).toFixed(2)}</td>
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

            <div class="total">Total Expenses: $${total.toFixed(2)}</div>

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