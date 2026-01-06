const tg = window.Telegram.WebApp;
tg.expand();

// Налаштування теми
if (tg.colorScheme === 'light') {
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#000000';
}

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

// 👇 Спробуй для тесту канал 'tsnug' (там точно є фото) або свій канал
const CHANNEL_USERNAME = 'ssternenko'; 

const RSS_SERVICES = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

// Картинка, яка буде, якщо справжню не вдалось завантажити
const DEFAULT_IMAGE = 'https://placehold.co/600x400/2a2a2e/FFF?text=News';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ
// ==========================================

async function loadNews() {
    const container = document.getElementById('news-feed');
    // Красивий спінер завантаження
    container.innerHTML = '<div class="loading">📡 Отримуємо дані...</div>';

    for (let i = 0; i < RSS_SERVICES.length; i++) {
        // Додаємо api_key=0, щоб уникнути кешування (іноді допомагає)
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_SERVICES[i])}&api_key=kq5b546876547657567`;

        try {
            const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_SERVICES[i])}`);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                container.innerHTML = ''; 
                
                data.items.forEach(item => {
                    const parsedItem = parseTelegramPost(item);
                    if (parsedItem) createCard(parsedItem);
                });
                return; // Успіх!
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} не спрацювало.`);
        }
    }

    container.innerHTML = `<div class="error">Помилка завантаження @${CHANNEL_USERNAME}</div>`;
}

// ==========================================
// 🧠 ОБРОБКА (ВИПРАВЛЕНО РОБОТУ З КАРТИНКАМИ)
// ==========================================

function parseTelegramPost(item) {
    // 1. ПРІОРИТЕТ 1: Шукаємо вкладення (enclosure) - це найнадійніший спосіб
    let imageSrc = item.enclosure?.link;

    // 2. ПРІОРИТЕТ 2: Шукаємо тег <img> в описі
    if (!imageSrc) {
        const imgRegex = /src="([^"]+)"/;
        const match = item.description.match(imgRegex);
        if (match) imageSrc = match[1];
    }

    // 3. ПРІОРИТЕТ 3: Шукаємо в thumbnail
    if (!imageSrc && item.thumbnail) {
        imageSrc = item.thumbnail;
    }

    // Якщо це ВІДЕО (mp4), RSS може дати посилання, але <img> його не покаже.
    // Тому ставимо заглушку, якщо розширення файлу не картинка
    if (imageSrc && imageSrc.includes('.mp4')) {
        imageSrc = DEFAULT_IMAGE;
    }

    // Якщо картинки немає зовсім
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // ПРОКСІ для обходу захисту Телеграм (wsrv.nl)
    // Додаємо це, щоб картинка точно відкрилась
    if (imageSrc !== DEFAULT_IMAGE) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // Чистка тексту
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();

    if (!cleanText) cleanText = "Читати далі...";

    // Дата
    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    return {
        title: item.title && !item.title.startsWith('http') ? item.title : "Новина",
        short: cleanText.substring(0, 80) + "...",
        full: cleanText,
        image: imageSrc,
        date: dateStr,
        link: item.link
    };
}

// ==========================================
// 🎨 ІНТЕРФЕЙС (З ОБРОБКОЮ ПОМИЛОК КАРТИНОК)
// ==========================================

function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    card.onclick = () => openModal(newsItem);

    // ЗВЕРНИ УВАГУ: added onerror="..."
    // Якщо картинка не завантажиться, вона заміниться на заглушку
    card.innerHTML = `
        <img src="${newsItem.image}" 
             class="card-thumb" 
             loading="lazy" 
             onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}';">
        
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <p class="card-desc">${newsItem.short}</p>
            <span class="card-time">${newsItem.date}</span>
        </div>
    `;
    container.appendChild(card);
}

// МОДАЛЬНЕ ВІКНО
function openModal(newsItem) {
    const modalImg = document.getElementById('modal-img');
    modalImg.src = newsItem.image;
    // Теж додаємо обробку помилки для великої картинки
    modalImg.onerror = function() { this.src = DEFAULT_IMAGE; };

    document.getElementById('modal-date').innerText = newsItem.date;
    document.getElementById('modal-title').innerText = newsItem.title;
    document.getElementById('modal-text').innerText = newsItem.full;
    document.getElementById('modal-link').href = newsItem.link;

    document.getElementById('news-modal').classList.add('active');
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    tg.BackButton.hide();
}

// ЗАПУСК
loadNews();
