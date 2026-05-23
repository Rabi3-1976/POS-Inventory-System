const API = "";
async function testBranchDashboard() {
    alert("Branch dashboard function is loaded");

    const res = await fetch(API + "/branch-dashboard");
    const data = await res.json();

    console.log(data);
    alert("Sales rows: " + data.sales.length);
}
let token = "";
let currentRole = "";
let cart = [];
let branchesCache = [];
let salesProfitChart = null;
let stockChart = null;
// USER MANAGEMENT
async function createUser() {
    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value.trim();
    const role = document.getElementById("newRole").value;

    const res = await fetch(API + "/create-user", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password, role })
    });

    const data = await res.json();
    alert(data.message || data.error);
}
// LOGIN
async function login() {

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {

        const res = await fetch(API + "/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
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

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        document.getElementById("adminSection").style.display =
            currentRole === "admin" ? "block" : "none";

        document.getElementById("usersMenuBtn").style.display =
            currentRole === "admin" ? "block" : "none";

        showPage("productsPage");

        loadProducts();

    } catch (err) {

        console.error("LOGIN ERROR:", err);

        alert("Login failed");
    }
}
// LOAD BRANCHES CACHE
async function loadBranchDashboard() {
    const res = await fetch(API + "/branch-dashboard");
    const data = await res.json();

    const salesTable = document.getElementById("branchSalesDashboardTable");
    const stockTable = document.getElementById("branchStockDashboardTable");

    salesTable.innerHTML = "";
    stockTable.innerHTML = "";

    data.sales.forEach(row => {
        salesTable.innerHTML += `
            <tr>
                <td>${row.branch_name}</td>
                <td>${Number(row.total_sales || 0).toFixed(2)}</td>
                <td>${Number(row.total_profit || 0).toFixed(2)}</td>
            </tr>
        `;
    });

    data.stock.forEach(row => {
        const low = data.lowStock.find(x => Number(x.branch_id) === Number(row.branch_id));

        stockTable.innerHTML += `
            <tr>
                <td>${row.branch_name}</td>
                <td>${row.total_stock}</td>
                <td>${low ? low.low_stock_items : 0}</td>
            </tr>
        `;
    });
}
// LOAD BRANCHES CACHE
async function loadBranchesCache() {
    const res = await fetch(API + "/branches");
    branchesCache = await res.json();
}
// LOAD PRODUCTS
async function loadProducts() {
    await loadBranchesCache();

    const res = await fetch(API + "/products");
    const products = await res.json();

    displayProducts(products);
}
// RECEIVE TO BRANCH
async function receiveToBranch(productId) {
    const branch_id = document.getElementById("branch_" + productId).value;
    const qty = Number(document.getElementById("branch_qty_" + productId).value);

    if (!branch_id || qty <= 0) {
        alert("Please select branch and enter valid quantity");
        return;
    }

    const res = await fetch(API + "/receive-to-branch", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            branch_id,
            product_id: productId,
            qty
        })
    });

    const data = await res.json();
    alert(data.message || data.error);

    loadProducts();
    loadDashboard();

    if (typeof loadBranchStock === "function") {
        loadBranchStock();
    }
}
// DISPLAY PRODUCTS
function displayProducts(products) {
    const table = document.getElementById("productTable");
    table.innerHTML = "";

    products.forEach(p => {

        const branchOptions = branchesCache.map(b => {
            return `<option value="${b.id}">${b.name}</option>`;
        }).join("");

        table.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.barcode}</td>
                <td>${p.price}</td>
                <td>${p.stock}</td>

                <td>
                    <select id="branch_${p.id}">
                        ${branchOptions}
                    </select>
                </td>

                <td>
                    <input id="branch_qty_${p.id}" type="number" min="1" placeholder="Qty" style="width:80px;">
                </td>

                <td>
                    <button onclick="receiveToBranch(${p.id})">Receive Branch</button>
                </td>

                <td><button onclick="receive(${p.id})">+</button></td>
                <td><button onclick="sell(${p.id})">-</button></td>
                <td>
                    ${currentRole === "admin" ? `<button onclick="deleteProduct(${p.id})">Delete</button>` : ""}
                </td>
            </tr>
        `;
    });
}

// SEARCH PRODUCT
async function searchProduct() {
    const barcode = document.getElementById("searchBarcode").value;

    const res = await fetch(API + "/products");
    const products = await res.json();

    const filtered = products.filter(p => p.barcode == barcode);

    displayProducts(filtered);
}
// DELETE PRODUCT
async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;

    await fetch(API + "/products/" + id, {
        method: "DELETE"
    });

    loadProducts();
    loadDashboard();;
}
// RECEIVING
async function receive(id) {
    const qty = prompt("Enter quantity to receive:");
    if (!qty) return;

    await fetch(API + "/receiving", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ product_id: id, qty: Number(qty) })
    });

    loadProducts();
    loadDashboard();
}

// SALES
async function sell(id) {
    const qty = prompt("Enter quantity to sell:");
    if (!qty) return;

    const res = await fetch(API + "/sales", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ product_id: id, qty: Number(qty) })
    });

    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    alert(data.message);

    printReceipt(id, qty);

    loadProducts();
    loadDashboard();
}
async function loadDashboard() {
    const res = await fetch(API + "/dashboard");
    const data = await res.json();

    document.getElementById("totalProducts").innerText =
        data.totalProducts ?? data.total_products ?? 0;

    document.getElementById("totalStock").innerText =
        data.totalStock ?? data.total_stock ?? 0;

    document.getElementById("totalSales").innerText =
        Number(data.totalSales ?? data.total_sales ?? 0).toFixed(2);

    document.getElementById("lowStock").innerText =
        data.lowStock ?? data.low_stock ?? 0;

    document.getElementById("totalProfit").innerText =
        Number(data.totalProfit ?? data.total_profit ?? 0).toFixed(2);
}
async function printInventoryReport() {
    const res = await fetch(API + "/products");
    const products = await res.json();

    let reportWindow = window.open("", "_blank");

    let html = `
        <html>
        <head>
            <title>Inventory Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Inventory Report</h1>
            <p>Date: ${new Date().toLocaleString()}</p>

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
                <tbody>
    `;

    products.forEach(p => {
        html += `
            <tr>
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.barcode}</td>
                <td>${p.price}</td>
                <td>${p.stock}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>

            <script>
                window.print();
            </script>
        </body>
        </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
}
async function exportInventoryExcel() {
    const res = await fetch(API + "/products");
    const products = await res.json();

    let csv = "ID,Product,Barcode,Price,Stock\n";

    products.forEach(p => {
        csv += `${p.id},${p.name},${p.barcode},${p.price},${p.stock}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "inventory_report.csv";
    link.click();
}
async function printSalesReport() {
    const res = await fetch(API + "/sales-report");
    const sales = await res.json();

    let reportWindow = window.open("", "_blank");

    let html = `
        <html>
        <head>
            <title>Sales Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Sales Report</h1>
            <p>Date: ${new Date().toLocaleString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sales.forEach(s => {
        html += `
            <tr>
                <td>${s.id}</td>
                <td>${s.product_name}</td>
                <td>${s.barcode}</td>
                <td>${s.qty}</td>
                <td>${(Number(s.price) / Number(s.qty)).toFixed(2)}</td>
                <td>${Number(s.price).toFixed(2)}</td>
                <td>${s.date}</td>
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
}

async function exportSalesExcel() {
    const res = await fetch(API + "/sales-report");
    const sales = await res.json();

    let csv = "ID,Product,Barcode,Qty,Price,Total,Date\n";

    sales.forEach(s => {
       csv += `${s.id},${s.product_name},${s.barcode},${s.qty},${(Number(s.price) / Number(s.qty)).toFixed(2)},${Number(s.price).toFixed(2)},${s.date}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sales_report.csv";
    link.click();
}

async function printReceivingReport() {
    const res = await fetch(API + "/receiving-report");
    const receiving = await res.json();

    let reportWindow = window.open("", "_blank");

    let html = `
        <html>
        <head>
            <title>Receiving Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Receiving Report</h1>
            <p>Date: ${new Date().toLocaleString()}</p>
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
                <tbody>
    `;

    receiving.forEach(r => {
        html += `
            <tr>
                <td>${r.id}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.qty}</td>
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
}

async function exportReceivingExcel() {
    const res = await fetch(API + "/receiving-report");
    const receiving = await res.json();

    let csv = "ID,Product,Barcode,Qty,Date\n";

    receiving.forEach(r => {
        csv += `${r.id},${r.product_name},${r.barcode},${r.qty},${r.date}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "receiving_report.csv";
    link.click();
}
async function searchByBarcode() {
    const barcode = document.getElementById("barcodeSearchInput").value.trim();

    if (!barcode) {
        alert("Please enter or scan barcode");
        return;
    }

    const res = await fetch(API + "/products");
    const products = await res.json();

    const filtered = products.filter(p => p.barcode === barcode);

    if (filtered.length === 0) {
        alert("Product not found");
        return;
    }

    displayProducts(filtered);
}
document.addEventListener("DOMContentLoaded", function () {
    const barcodeInput = document.getElementById("barcodeSearchInput");

    if (barcodeInput) {
        barcodeInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                searchByBarcode();
            }
        });
    }
});
async function printReceipt(productId, qty) {
    const res = await fetch(API + "/products");
    const products = await res.json();

    const product = products.find(p => p.id == productId);
    if (!product) return;

    const total = Number(product.price) * Number(qty);

    let receiptWindow = window.open("", "_blank");

    let html = `
        <html>
        <head>
            <title>Sales Receipt</title>
            <style>
                body { font-family: Arial; padding: 20px; width: 300px; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 6px; border-bottom: 1px dashed #ccc; }
                .total { font-weight: bold; font-size: 18px; }
            </style>
        </head>
        <body>
            <h2>POS Receipt</h2>
            <p>Date: ${new Date().toLocaleString()}</p>

            <table>
                <tr><td>Product</td><td>${product.name}</td></tr>
                <tr><td>Barcode</td><td>${product.barcode}</td></tr>
                <tr><td>Qty</td><td>${qty}</td></tr>
                <tr><td>Price</td><td>${product.price}</td></tr>
                <tr class="total"><td>Total</td><td>${total.toFixed(2)}</td></tr>
            </table>

            <p style="text-align:center;">Thank you</p>

            <script>
                window.print();
            </script>
        </body>
        </html>
    `;

    receiptWindow.document.write(html);
    receiptWindow.document.close();
}
async function loadUsers() {
    const res = await fetch(API + "/users", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const users = await res.json();

    const table = document.getElementById("usersTable");
    table.innerHTML = "";

    users.forEach(u => {
        table.innerHTML += `
            <tr>
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td><button onclick="changeUserPassword(${u.id})">Change Password</button></td>
                <td><button onclick="deleteUser(${u.id})">Delete</button></td>
            </tr>
        `;
    });
}

async function changeUserPassword(id) {
    const password = prompt("Enter new password:");
    if (!password) return;

    const res = await fetch(API + "/users/" + id + "/password", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ password })
    });

    const data = await res.json();
    alert(data.message || data.error);
}
async function loadSaleBranchOptions() {
    const res = await fetch(API + "/branches");
    const branches = await res.json();

    const select = document.getElementById("saleBranch");
    select.innerHTML = "";

    branches.forEach(b => {
        select.innerHTML += `<option value="${b.id}">${b.name}</option>`;
    });
}
async function deleteUser(id) {
    if (!confirm("Delete this user?")) return;

    const res = await fetch(API + "/users/" + id, {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    alert(`${product.name} → Received ${qty} units`);
    loadUsers();
}
async function receiveByBarcode() {
    const barcode = document.getElementById("receiveBarcode").value.trim();
    const qty = Number(document.getElementById("receiveQty").value);

    if (!barcode || qty <= 0) {
        alert("Please enter barcode and valid quantity");
        return;
    }

    const resProducts = await fetch(API + "/products");
    const products = await resProducts.json();

    const product = products.find(p => p.barcode === barcode);

    if (!product) {
        alert("Product not found");
        return;
    }

    const res = await fetch(API + "/receiving", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            product_id: product.id,
            qty: qty
        })
    });

    const data = await res.json();
    alert(data.message || data.error);

    document.getElementById("receiveBarcode").value = "";
    document.getElementById("receiveQty").value = "";

    loadProducts();
    loadDashboard();
    loadCharts();
}
document.addEventListener("DOMContentLoaded", function () {
    const receiveBarcode = document.getElementById("receiveBarcode");

    if (receiveBarcode) {
        receiveBarcode.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                document.getElementById("receiveQty").focus();
            }
        });
    }

    const receiveQty = document.getElementById("receiveQty");

    if (receiveQty) {
        receiveQty.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                receiveByBarcode();
            }
        });
    }
});
window.onload = () => {
    const barcodeInput = document.getElementById("receiveBarcode");
    if (barcodeInput) barcodeInput.focus();
};
function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.style.display = "none";
    });

    document.getElementById(pageId).style.display = "block";

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

    if (pageId === "usersPage") {
        loadUsers();
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

    if (pageId === "posPage") {
        loadSaleBranchOptions();

        setTimeout(() => {
            document.getElementById("posBarcode").focus();
        }, 100);
    }
}

async function sellByBarcode() {
    const barcode = document.getElementById("posBarcode").value.trim();
    const qty = Number(document.getElementById("posQty").value);

    if (!barcode || qty <= 0) {
        alert("Please enter barcode and valid quantity");
        return;
    }

    const resProducts = await fetch(API + "/products");
    const products = await resProducts.json();

    const product = products.find(p => p.barcode === barcode);

    if (!product) {
        alert("Product not found");
        return;
    }

const res = await fetch(API + "/branch-sale", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
        branch_id: item.branch_id,
        product_id: item.id,
        qty: item.qty
    })
});

    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    alert(`${product.name} sold successfully`);

    document.getElementById("posBarcode").value = "";
    document.getElementById("posQty").value = 1;

    printReceipt(product.id, qty);
    loadProducts();
    loadDashboard();
}
async function addToCart() {
    const barcode = document.getElementById("posBarcode").value.trim();
    const qty = Number(document.getElementById("posQty").value);

    if (!barcode || qty <= 0) {
        alert("Please enter barcode and valid quantity");
        return;
    }

    const res = await fetch(API + "/products");
    const products = await res.json();
    const branch_id = document.getElementById("saleBranch").value;

if (!branch_id) {
    alert("Please select branch");
    return;
}
    const product = products.find(p => p.barcode === barcode);

    if (!product) {
        alert("Product not found");
        return;
    }

    if (product.stock < qty) {
        alert("Not enough stock");
        return;
    }

    const existing = cart.find(item => item.id === product.id);

    if (existing) {
        if (product.stock < existing.qty + qty) {
            alert("Not enough stock for total cart quantity");
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
    branch_id: branch_id
});
    }

    document.getElementById("posBarcode").value = "";
    document.getElementById("posQty").value = 1;

    displayCart();
}

function displayCart() {
    const table = document.getElementById("cartTable");
    const totalBox = document.getElementById("cartTotal");

    table.innerHTML = "";

    let total = 0;

    cart.forEach((item, index) => {
        const lineTotal = item.price * item.qty;
        total += lineTotal;

        table.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.barcode}</td>
                <td>${item.qty}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>${lineTotal.toFixed(2)}</td>
                <td><button onclick="removeFromCart(${index})">Remove</button></td>
            </tr>
        `;
    });

    totalBox.innerText = total.toFixed(2);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    displayCart();
}

function clearCart() {
    cart = [];
    displayCart();
}

async function checkoutCart() {
    if (cart.length === 0) {
        alert("Cart is empty");
        return;
    }

    for (const item of cart) {
        const res = await fetch(API + "/branch-sale", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                branch_id: item.branch_id,
                product_id: item.id,
                qty: item.qty
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
}

function printCartReceipt() {
    let receiptWindow = window.open("", "_blank");

    let total = 0;
    let rows = "";

    cart.forEach(item => {
        const lineTotal = item.price * item.qty;
        total += lineTotal;

        rows += `
            <tr>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>${lineTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    const invoiceNumber = "INV-" + Date.now();

    const html = `
        <html>
        <head>
            <title>Invoice</title>

            <style>
                body {
                    font-family: Arial;
                    padding: 20px;
                    width: 400px;
                    color: #222;
                }

                .header {
                    text-align: center;
                    margin-bottom: 20px;
                }

                .header img {
                    width: 80px;
                    height: 80px;
                    object-fit: contain;
                }

                h1 {
                    margin: 5px 0;
                }

                .company-info {
                    font-size: 13px;
                    color: #555;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                th, td {
                    border-bottom: 1px solid #ddd;
                    padding: 8px;
                    text-align: center;
                    font-size: 14px;
                }

                th {
                    background: #f2f2f2;
                }

                .total {
                    text-align: right;
                    margin-top: 20px;
                    font-size: 20px;
                    font-weight: bold;
                }

                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 13px;
                    color: #666;
                }
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
                <strong>Date:</strong> ${new Date().toLocaleString()}
            </p>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div class="total">
                Grand Total: $${total.toFixed(2)}
            </div>

            <div class="footer">
                Thank you for your business
            </div>

            <script>
                window.print();
            </script>

        </body>
        </html>
    `;

    receiptWindow.document.write(html);
    receiptWindow.document.close();
}
document.addEventListener("DOMContentLoaded", function () {
    const posBarcode = document.getElementById("posBarcode");

    if (posBarcode) {
        posBarcode.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                addToCart();
            }
        });
    }
});
async function addSupplier() {
    const name = document.getElementById("supplierName").value.trim();
    const phone = document.getElementById("supplierPhone").value.trim();
    const email = document.getElementById("supplierEmail").value.trim();
    const address = document.getElementById("supplierAddress").value.trim();

    const res = await fetch(API + "/suppliers", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ name, phone, email, address })
    });

    const data = await res.json();
    alert(data.message || data.error);

    loadSupplierOptions();
}

async function loadSupplierOptions() {
    const suppliersRes = await fetch(API + "/suppliers");
    const suppliers = await suppliersRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const supplierSelect = document.getElementById("poSupplier");
    const productSelect = document.getElementById("poProduct");

    supplierSelect.innerHTML = "";
    productSelect.innerHTML = "";

    suppliers.forEach(s => {
        supplierSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    products.forEach(p => {
        productSelect.innerHTML += `<option value="${p.id}">${p.name} - ${p.barcode}</option>`;
    });
}

async function createPurchaseOrder() {
    const supplier_id = document.getElementById("poSupplier").value;
    const product_id = document.getElementById("poProduct").value;
    const qty = Number(document.getElementById("poQty").value);

    if (!supplier_id || !product_id || qty <= 0) {
        alert("Please select supplier/product and enter valid qty");
        return;
    }

    const res = await fetch(API + "/purchase-orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ supplier_id, product_id, qty })
    });

    const data = await res.json();
    alert(data.message || data.error);

    document.getElementById("poQty").value = "";
    loadPurchaseOrders();
}

async function loadPurchaseOrders() {
    const res = await fetch(API + "/purchase-orders");
    const orders = await res.json();

    const table = document.getElementById("purchaseOrdersTable");
    table.innerHTML = "";

    orders.forEach(o => {
        table.innerHTML += `
            <tr>
                <td>${o.id}</td>
                <td>${o.supplier_name}</td>
                <td>${o.product_name}</td>
                <td>${o.barcode}</td>
                <td>${o.qty}</td>
                <td>${o.status}</td>
                <td>${o.date}</td>
                <td>
                    ${
                        o.status === "Received"
                        ? "Received"
                        : `<button onclick="receivePurchaseOrder(${o.id})">Receive</button>`
                    }
                </td>
            </tr>
        `;
    });
}
async function receivePurchaseOrder(id) {
    if (!confirm("Receive this purchase order and update stock?")) return;

    const res = await fetch(API + "/purchase-orders/" + id + "/receive", {
        method: "PUT",
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const data = await res.json();
    alert(data.message || data.error);

    loadPurchaseOrders();
    loadProducts();
    loadDashboard();
    loadCharts();
}
function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.style.display = "none";
    });

    document.getElementById(pageId).style.display = "block";

    if (pageId === "dashboardPage") {
        loadDashboard();
        loadCharts();
    }

    if (pageId === "productsPage") {
        loadProducts();
    }

    if (pageId === "usersPage") {
        loadUsers();
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

    if (pageId === "posPage") {
        loadSaleBranchOptions();
        setTimeout(() => {
            document.getElementById("posBarcode").focus();
        }, 100);
    }
}
let html5QrCode = null;

function startPOSScanner() {
    stopScanner();

    html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        decodedText => {
            document.getElementById("posBarcode").value = decodedText;
            stopScanner();
            addToCart();
        },
        errorMessage => {}
    ).catch(err => {
        alert("Camera error: " + err);
    });
}

function startReceivingScanner() {
    stopScanner();

    html5QrCode = new Html5Qrcode("receivingReader");

    html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        decodedText => {
            document.getElementById("receiveBarcode").value = decodedText;
            stopScanner();
            document.getElementById("receiveQty").focus();
        },
        errorMessage => {}
    ).catch(err => {
        alert("Camera error: " + err);
    });
}

function stopScanner() {
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
}
async function loadCharts() {
    await loadSalesProfitChart();
    await loadStockChart();
}

async function loadSalesProfitChart() {
    const res = await fetch(API + "/charts/sales-profit");
    const data = await res.json();

    const labels = data.map(x => x.sale_date);
    const sales = data.map(x => x.total_sales || 0);
    const profit = data.map(x => x.total_profit || 0);

    const ctx = document.getElementById("salesProfitChart");

    if (salesProfitChart) {
        salesProfitChart.destroy();
    }

    salesProfitChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Sales",
                    data: sales
                },
                {
                    label: "Profit",
                    data: profit
                }
            ]
        },
        options: {
            responsive: true
        }
    });
}

async function loadStockChart() {
    const res = await fetch(API + "/charts/stock");
    const data = await res.json();

    const labels = data.map(x => x.name);
    const stock = data.map(x => x.stock || 0);

    const ctx = document.getElementById("stockChart");

    if (stockChart) {
        stockChart.destroy();
    }

    stockChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Current Stock",
                    data: stock
                }
            ]
        },
        options: {
            responsive: true
        }
    });
}
window.addEventListener("load", async () => {

    const savedToken = localStorage.getItem("token");
    const savedRole = localStorage.getItem("role");

    if (savedToken && savedRole) {

        token = savedToken;
        currentRole = savedRole;

        document.getElementById("loginSection").style.display = "none";
        document.getElementById("mainSection").style.display = "block";

        document.getElementById("adminSection").style.display =
            currentRole === "admin" ? "block" : "none";

        document.getElementById("usersMenuBtn").style.display =
            currentRole === "admin" ? "block" : "none";

        showPage("productsPage");

        try {
            await loadProducts();
        } catch (err) {
            console.error("LOAD PRODUCTS ERROR:", err);
        }

    } else {

        document.getElementById("loginSection").style.display = "block";
        document.getElementById("mainSection").style.display = "none";
    }
});
async function importProducts() {

    const fileInput = document.getElementById("importFile");

    if (!fileInput.files.length) {
        alert("Please select file");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const res = await fetch(API + "/import-products", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    alert(data.message || data.error);

    loadProducts();
    loadDashboard();
}
async function addBranch() {
    const name = document.getElementById("branchName").value.trim();
    const location = document.getElementById("branchLocation").value.trim();

    if (!name) {
        alert("Please enter branch name");
        return;
    }

    const res = await fetch(API + "/branches", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ name, location })
    });

    const data = await res.json();
    alert(data.message || data.error);

    document.getElementById("branchName").value = "";
    document.getElementById("branchLocation").value = "";

    loadBranches();
}

async function loadBranches() {
    const res = await fetch(API + "/branches");
    const branches = await res.json();

    const table = document.getElementById("branchesTable");
    table.innerHTML = "";

    branches.forEach(b => {
        table.innerHTML += `
            <tr>
                <td>${b.id}</td>
                <td>${b.name}</td>
                <td>${b.location || ""}</td>
            </tr>
        `;
    });
}
async function loadBranchStockOptions() {
    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const branchSelect = document.getElementById("stockBranch");
    const productSelect = document.getElementById("stockProduct");

    branchSelect.innerHTML = "";
    productSelect.innerHTML = "";

    branches.forEach(b => {
        branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
    });

    products.forEach(p => {
        productSelect.innerHTML += `<option value="${p.id}">${p.name} - ${p.barcode}</option>`;
    });
}

async function saveBranchStock() {
    const branch_id = document.getElementById("stockBranch").value;
    const product_id = document.getElementById("stockProduct").value;
    const stock = Number(document.getElementById("branchStockQty").value);

    if (!branch_id || !product_id || stock < 0) {
        alert("Please select branch/product and enter valid stock");
        return;
    }

    const res = await fetch(API + "/branch-stock", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ branch_id, product_id, stock })
    });

    const data = await res.json();
    alert(data.message || data.error);

    document.getElementById("branchStockQty").value = "";

    loadBranchStock();
}

async function loadBranchStock() {
    const res = await fetch(API + "/branch-stock");
    const rows = await res.json();

    const table = document.getElementById("branchStockTable");
    table.innerHTML = "";

    rows.forEach(r => {
        table.innerHTML += `
            <tr>
                <td>${r.id}</td>
                <td>${r.branch_name}</td>
                <td>${r.product_name}</td>
                <td>${r.barcode}</td>
                <td>${r.stock}</td>
            </tr>
        `;
    });
}
async function loadTransferOptions() {
    const branchesRes = await fetch(API + "/branches");
    const branches = await branchesRes.json();

    const productsRes = await fetch(API + "/products");
    const products = await productsRes.json();

    const fromBranch = document.getElementById("fromBranch");
    const toBranch = document.getElementById("toBranch");
    const transferProduct = document.getElementById("transferProduct");

    fromBranch.innerHTML = "";
    toBranch.innerHTML = "";
    transferProduct.innerHTML = "";

    branches.forEach(b => {
        fromBranch.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        toBranch.innerHTML += `<option value="${b.id}">${b.name}</option>`;
    });

    products.forEach(p => {
        transferProduct.innerHTML += `<option value="${p.id}">${p.name} - ${p.barcode}</option>`;
    });
}

async function transferStock() {
    const from_branch_id = document.getElementById("fromBranch").value;
    const to_branch_id = document.getElementById("toBranch").value;
    const product_id = document.getElementById("transferProduct").value;
    const qty = Number(document.getElementById("transferQty").value);

    if (!from_branch_id || !to_branch_id || !product_id || qty <= 0) {
        alert("Please select branches/product and enter valid quantity");
        return;
    }

    const res = await fetch(API + "/stock-transfer", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            from_branch_id,
            to_branch_id,
            product_id,
            qty
        })
    });

    const data = await res.json();
    alert(data.message || data.error);

    document.getElementById("transferQty").value = "";

    loadBranchStock();
    loadStockTransfers();
}

async function loadStockTransfers() {
    const res = await fetch(API + "/stock-transfers");
    const transfers = await res.json();

    const table = document.getElementById("stockTransfersTable");
    table.innerHTML = "";

    transfers.forEach(t => {
        table.innerHTML += `
            <tr>
                <td>${t.id}</td>
                <td>${t.from_branch}</td>
                <td>${t.to_branch}</td>
                <td>${t.product_name}</td>
                <td>${t.barcode}</td>
                <td>${t.qty}</td>
                <td>${t.date}</td>
            </tr>
        `;
    });
}
async function printBranchSalesReport() {
    const res = await fetch(API + "/branch-sales-report");
    const sales = await res.json();

    let reportWindow = window.open("", "_blank");

    let html = `
        <html>
        <head>
            <title>Branch Sales Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Branch Sales Report</h1>
            <p>Date: ${new Date().toLocaleString()}</p>

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

    sales.forEach(s => {
        const unitPrice = Number(s.price) / Number(s.qty || 1);
        const total = Number(s.price);
        const profit = Number(s.profit || 0);

        html += `
            <tr>
                <td>${s.id}</td>
                <td>${s.branch_name}</td>
                <td>${s.product_name}</td>
                <td>${s.barcode}</td>
                <td>${s.qty}</td>
                <td>${unitPrice.toFixed(2)}</td>
                <td>${total.toFixed(2)}</td>
                <td>${profit.toFixed(2)}</td>
                <td>${s.date}</td>
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
}

async function exportBranchSalesExcel() {
    const res = await fetch(API + "/branch-sales-report");
    const sales = await res.json();

    let csv = "ID,Branch,Product,Barcode,Qty,Unit Price,Total,Profit,Date\n";

    sales.forEach(s => {
        const unitPrice = Number(s.price) / Number(s.qty || 1);
        const total = Number(s.price);
        const profit = Number(s.profit || 0);

        csv += `${s.id},${s.branch_name},${s.product_name},${s.barcode},${s.qty},${unitPrice.toFixed(2)},${total.toFixed(2)},${profit.toFixed(2)},${s.date}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "branch_sales_report.csv";
    link.click();
}
async function printTransferReport() {
    const res = await fetch(API + "/stock-transfers");
    const transfers = await res.json();

    let reportWindow = window.open("", "_blank");

    let html = `
        <html>
        <head>
            <title>Stock Transfer Report</title>
            <style>
                body { font-family: Arial; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                th { background: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Stock Transfer Report</h1>
            <p>Date: ${new Date().toLocaleString()}</p>

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
                <tbody>
    `;

    transfers.forEach(t => {
        html += `
            <tr>
                <td>${t.id}</td>
                <td>${t.from_branch}</td>
                <td>${t.to_branch}</td>
                <td>${t.product_name}</td>
                <td>${t.barcode}</td>
                <td>${t.qty}</td>
                <td>${t.date}</td>
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
}

async function exportTransferExcel() {
    const res = await fetch(API + "/stock-transfers");
    const transfers = await res.json();

    let csv = "ID,From Branch,To Branch,Product,Barcode,Qty,Date\n";

    transfers.forEach(t => {
        csv += `${t.id},${t.from_branch},${t.to_branch},${t.product_name},${t.barcode},${t.qty},${t.date}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "stock_transfer_report.csv";
    link.click();
}
async function loadBranchDashboard() {
    const res = await fetch(API + "/branch-dashboard");
    const data = await res.json();

    const salesTable = document.getElementById("branchSalesDashboardTable");
    const stockTable = document.getElementById("branchStockDashboardTable");

    if (!salesTable || !stockTable) {
        alert("Branch dashboard table IDs not found in index.html");
        return;
    }

    salesTable.innerHTML = "";
    stockTable.innerHTML = "";

    data.sales.forEach(row => {
        salesTable.innerHTML += `
            <tr>
                <td>${row.branch_name}</td>
                <td>${Number(row.total_sales || 0).toFixed(2)}</td>
                <td>${Number(row.total_profit || 0).toFixed(2)}</td>
            </tr>
        `;
    });

    data.stock.forEach(row => {
        const low = data.lowStock.find(x => Number(x.branch_id) === Number(row.branch_id));

        stockTable.innerHTML += `
            <tr>
                <td>${row.branch_name}</td>
                <td>${row.total_stock}</td>
                <td>${low ? low.low_stock_items : 0}</td>
            </tr>
        `;
    });
}


// LOGOUT FUNCTION
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");

    token = "";
    currentRole = "";

    document.getElementById("username").value = "";
    document.getElementById("password").value = "";

    document.getElementById("mainSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
}
// Force reload branch dashboard data (used after stock transfer to update low stock count)
async function forceBranchDashboard() {
    const res = await fetch("/branch-dashboard");
    const data = await res.json();

    document.getElementById("branchSalesDashboardTable").innerHTML =
        data.sales.map(r => `
            <tr>
                <td>${r.branch_name}</td>
                <td>${Number(r.total_sales || 0).toFixed(2)}</td>
                <td>${Number(r.total_profit || 0).toFixed(2)}</td>
            </tr>
        `).join("");

    document.getElementById("branchStockDashboardTable").innerHTML =
        data.stock.map(r => {
            const low = data.lowStock.find(x => Number(x.branch_id) === Number(r.branch_id));

            return `
                <tr>
                    <td>${r.branch_name}</td>
                    <td>${r.total_stock}</td>
                    <td>${low ? low.low_stock_items : 0}</td>
                </tr>
            `;
        }).join("");
}