const csvFileInput = document.getElementById("csvFile");
const uploadZone = document.getElementById("uploadZone");
const selectedFileName = document.getElementById("selectedFileName");
const tableMeta = document.getElementById("tableMeta");
const tablePagination = document.getElementById("tablePagination");

const rowsPerPage = 25;
let currentPage = 1;
let allRows = [];
const csvCookieName = "csvReaderCache";
const csvLocalStorageKey = "csvReaderCache";

document.addEventListener("DOMContentLoaded", function() {
    const cachedCsv = getCachedCsv();
    if (cachedCsv) {
        selectedFileName.textContent = "Loaded from browser cache";
        parseAndRenderCsv(cachedCsv, "Cached CSV");
    }
});

csvFileInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

uploadZone.addEventListener("click", function() {
    csvFileInput.click();
});

uploadZone.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        csvFileInput.click();
    }
});

["dragenter", "dragover"].forEach(eventName => {
    uploadZone.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add("is-dragover");
    });
});

["dragleave", "drop"].forEach(eventName => {
    uploadZone.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove("is-dragover");
    });
});

uploadZone.addEventListener("drop", function(e) {
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

function handleFile(file) {
    selectedFileName.textContent = file.name;

    file.text().then(function(csvText) {
        setCachedCsv(csvText);
        parseAndRenderCsv(csvText, file.name);
    }).catch(function(error) {
        console.error("Failed to read file:", error);
        selectedFileName.textContent = "Failed to read file";
    });
}

function parseAndRenderCsv(csvText, sourceName) {
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            allRows = results.data;
            currentPage = 1;
            if (sourceName && sourceName !== "Cached CSV") {
                selectedFileName.textContent = sourceName;
            }
            renderDashboard(allRows);
        },
        error: function(error) {
            console.error("CSV parse error:", error);
            selectedFileName.textContent = "Failed to parse CSV";
        }
    });
}

function renderDashboard(data) {

    renderSummary(data);
    renderTable(data);
}

function renderSummary(data) {
    let hydration = 0;
    let activityMinutes = 0;
    let mealCount = 0;
    let sleepHours = 0;

    data.forEach(row => {
        if (row.type === "Hydration" && row.unit === "ml") hydration += Number(row.amount);
        if (row.type === "Activity") activityMinutes += Number(row.amount);
        if (row.type === "Meal") mealCount++;
        if (row.type === "Recovery" && String(row.item || "").toLowerCase() === "sleep") sleepHours += Number(row.amount);
    });

    document.getElementById("hydrationTotal").textContent = hydration + " ml";
    document.getElementById("activityMinutes").textContent = activityMinutes + " min";
    document.getElementById("mealCount").textContent = mealCount;
    document.getElementById("sleepHours").textContent = sleepHours + " h";
}

function renderTable(data) {
    const tbody = document.querySelector("#dataTable tbody");
    tbody.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
    currentPage = Math.min(currentPage, totalPages);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const pageRows = data.slice(startIndex, startIndex + rowsPerPage);

    pageRows.forEach((row, index) => {
        tbody.innerHTML += `
            <tr>
                <td class="cell-center">${renderFavoriteIcon(index)}</td>
                <td>${renderProjectCell(row)}</td>
                <td>${renderTitleCell(row)}</td>
                <td>${renderStatusCell(row)}</td>
                <td>${renderUserCell(row)}</td>
                <td>${renderUsersCell(row)}</td>
                <td>${renderNotesCell(row)}</td>
            </tr>
        `;
    });

    const start = data.length === 0 ? 0 : startIndex + 1;
    const end = Math.min(startIndex + pageRows.length, data.length);
    tableMeta.textContent = data.length === 0 ? "No rows loaded" : `Showing ${start}-${end} of ${data.length}`;
    renderPagination(totalPages);
}

function renderFavoriteIcon(index) {
    return `<button class="row-favorite ${index === 0 ? 'is-selected' : ''}" type="button" aria-label="Favorite row">☆</button>`;
}

function renderProjectCell(row) {
    const icon = getProjectIcon(row.type);
    return `
        <div class="project-cell">
            <span class="project-icon" aria-hidden="true">${icon}</span>
            <span class="user-label">${escapeHtml(getProjectLabel(row.type))}</span>
        </div>
    `;
}

function renderTitleCell(row) {
    return `
        <div class="title-cell">
            <span class="title-primary">${escapeHtml(row.item || "")}</span>
            <span class="title-secondary">${escapeHtml(`${row.date || ""} ${row.time || ""}`.trim())}</span>
        </div>
    `;
}

function renderStatusCell(row) {
    return `<span class="status-pill">${escapeHtml(row.type || "")}</span>`;
}

function renderUserCell(row) {
    const label = row.type === "Recovery" ? "Jane Rotanson" : "CSV Import";
    const avatar = label
        .split(" ")
        .map(part => part[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return `
        <div class="user-cell">
            <span class="user-avatar" aria-hidden="true">${escapeHtml(avatar || "CI")}</span>
            <span class="user-label">${escapeHtml(label)}</span>
        </div>
    `;
}

function renderUsersCell(row) {
    const seed = String(row.type || "").length + String(row.item || "").length;
    const avatars = ["AB", "CD", "EF"];
    const active = avatars.slice(0, 3);
    const count = (seed % 4) + 1;

    return `
        <div class="avatar-stack" aria-label="Shared with ${count + 2} users">
            ${active.map(label => `<span class="avatar">${label}</span>`).join("")}
            <span class="avatar-count">+${count}</span>
        </div>
    `;
}

function renderNotesCell(row) {
    return `
        <div class="notes-cell" title="${escapeHtml(row.notes || "")}">
            <span class="inline-icon" aria-hidden="true">${getLockIcon()}</span>
            <span class="user-label">${escapeHtml(row.notes || "")}</span>
        </div>
    `;
}

function renderPagination(totalPages) {
    if (!tablePagination) {
        return;
    }

    const pages = buildPagination(totalPages, currentPage);
    tablePagination.innerHTML = `
        <button class="pagination-button pagination-nav" type="button" aria-label="Previous page" ${currentPage === 1 ? "disabled" : ""}>‹</button>
        ${pages.map(item => item === "..."
            ? `<span class="pagination-ellipsis">...</span>`
            : `<button class="pagination-button ${item === currentPage ? "is-active" : ""}" type="button" data-page="${item}">${item}</button>`
        ).join("")}
        <button class="pagination-button pagination-nav" type="button" aria-label="Next page" ${currentPage === totalPages ? "disabled" : ""}>›</button>
    `;

    tablePagination.querySelectorAll("[data-page]").forEach(button => {
        button.addEventListener("click", function() {
            currentPage = Number(this.dataset.page);
            renderTable(allRows);
        });
    });

    const prevButton = tablePagination.querySelector("button[aria-label='Previous page']");
    const nextButton = tablePagination.querySelector("button[aria-label='Next page']");

    if (prevButton) {
        prevButton.addEventListener("click", function() {
            if (currentPage > 1) {
                currentPage -= 1;
                renderTable(allRows);
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", function() {
            if (currentPage < totalPages) {
                currentPage += 1;
                renderTable(allRows);
            }
        });
    }
}

function buildPagination(totalPages, activePage) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, activePage - 1);
    const end = Math.min(totalPages - 1, activePage + 1);

    if (start > 2) {
        pages.push("...");
    }

    for (let page = start; page <= end; page += 1) {
        pages.push(page);
    }

    if (end < totalPages - 1) {
        pages.push("...");
    }

    pages.push(totalPages);
    return pages;
}

function getProjectLabel(type) {
    return type || "Project";
}

function getProjectIcon(type) {
    if (type === "Hydration") {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5c4.2 0 7.5 3.3 7.5 7.5S16.2 17.5 12 17.5 4.5 14.2 4.5 10 7.8 2.5 12 2.5Z" stroke="currentColor" stroke-width="1.6"/><path d="M4.9 10h14.2M12 2.8c2.2 2 3.4 4.7 3.4 7.2S14.2 15.2 12 17.2c-2.2-2-3.4-4.7-3.4-7.2S9.8 4.8 12 2.8Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    }

    if (type === "Activity") {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5v4.7l3.1 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    if (type === "Meal") {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5v15M10 4.5v6a2 2 0 0 1-2 2H6M14.5 4.5v15M18 4.5v15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M18 4.5c0 2.2-1.6 3.8-3.5 3.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    }

    if (type === "Recovery") {
        return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.8 5.2a7.5 7.5 0 1 0 4 11.1A7.5 7.5 0 0 1 14.8 5.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    }

    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" stroke="currentColor" stroke-width="1.6"/></svg>';
}

function getLockIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.5 10.5v-2a4.5 4.5 0 1 1 9 0v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.8 10.5h10.4v8H6.8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 13.5v2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    const encodedValue = encodeURIComponent(value);

    if (encodedValue.length > 3500) {
        console.warn("CSV is too large to cache in cookies.");
        return false;
    }

    document.cookie = `${encodeURIComponent(name)}=${encodedValue}; expires=${expires}; path=/; SameSite=Lax`;
    return getCookie(name) === value;
}

function getCookie(name) {
    const cookieName = `${encodeURIComponent(name)}=`;
    const cookies = document.cookie ? document.cookie.split("; ") : [];

    for (const cookie of cookies) {
        if (cookie.startsWith(cookieName)) {
            return decodeURIComponent(cookie.slice(cookieName.length));
        }
    }

    return "";
}

function setCachedCsv(value) {
    const cookieStored = setCookie(csvCookieName, value, 7);

    try {
        localStorage.setItem(csvLocalStorageKey, value);
    } catch (error) {
        if (!cookieStored) {
            console.warn("Could not cache the CSV in browser storage.", error);
        }
    }
}

function getCachedCsv() {
    const cookieValue = getCookie(csvCookieName);
    if (cookieValue) {
        return cookieValue;
    }

    try {
        return localStorage.getItem(csvLocalStorageKey) || "";
    } catch (error) {
        console.warn("Could not read cached CSV from browser storage.", error);
        return "";
    }
}