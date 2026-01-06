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

// Канал для тестів (tsnug - там є відео і фото)
// Зміни на свій, коли створиш власний
const CHANNEL_USERNAME = 'tsnug'; 

const RSS_SERVICES = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/600x400/2a2a2e/FFF?text=News';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ
// ==========================================

async function loadNews() {
    const container = document.getElementById('news-feed');
    container.innerHTML = '<div class="loading">📡 Отримуємо дані...</div>';

    // Пробуємо різні дзеркала по черзі
    for (let i = 0; i < RSS_SERVICES.length; i++) {
        // Додаємо випадкове число, щоб уникнути кешування
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_SERVICES[i])}&nocache=${Date.now()}`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                container.innerHTML = ''; 
                data.items.forEach(item => {
                    const parsedItem = parseTelegramPost(item);
                    if (parsedItem) createCard(parsedItem);
                });
                return; // Якщо успіх - виходимо
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} не спрацювало.`);
        }
    }

    container.innerHTML = `<div class="error">Помилка завантаження @${CHANNEL_USERNAME}</div>`;
}

// ==========================================
// 🧠 ОБРОБКА ДАНИХ
// ==========================================

function parseTelegramPost(item) {
    // --- 1. Картинка для стрічки ---
    let imageSrc = item.enclosure?.link;
    
    if (!imageSrc) {
        const imgRegex = /src="([^"]+)"/;
        const match = item.description.match(imgRegex);
        if (match) imageSrc = match[1];
    }
    
    // Якщо це відео-файл (mp4), RSS дає посилання, але в <img> воно не працює.
    // Ставимо заглушку для відео, якщо немає прев'ю
    if (imageSrc && (imageSrc.includes('.mp4') || imageSrc.includes('video'))) {
        imageSrc = DEFAULT_IMAGE; // Можна замінити на іконку "Play"
    }

    if (!imageSrc && item.thumbnail) imageSrc = item.thumbnail;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // --- 2. Проксі для картинки (wsrv.nl) ---
    // Це потрібно, щоб Телеграм не блокував картинку в стрічці
    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=400&output=jpg`;
    }

    // --- 3. Текст ---
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();
    if (!cleanText) cleanText = "Натисніть, щоб переглянути...";

    // --- 4. Дата ---
    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    return {
        title: item.title && !item.title.startsWith('http') ? item.title : "Новина",
        short: cleanText.substring(0, 80) + "...",
        image: imageSrc,
        date: dateStr,
        link: item.link // Посилання на пост (наприклад https://t.me/tsnug/12345)
    };
}

// ==========================================
// 🎨 ІНТЕРФЕЙС (Стрічка)
// ==========================================

function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    card.onclick = () => openModal(newsItem);

    card.innerHTML = `
        <img src="${newsItem.image}" class="card-thumb" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <p class="card-desc">${newsItem.short}</p>
            <span class="card-time">${newsItem.date}</span>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 📱 МОДАЛЬНЕ ВІКНО (Віджет)
// ==========================================

function openModal(newsItem) {
    document.getElementById('modal-date').innerText = newsItem.date;
    document.getElementById('modal-title').innerText = newsItem.title;
    document.getElementById('modal-link').href = newsItem.link;

    // --- ВСТАВКА ВІДЖЕТА ---
    const widgetContainer = document.getElementById('telegram-widget-container');
    widgetContainer.innerHTML = '<div class="loading" style="font-size:0.8rem; padding:0;">Завантаження поста...</div>';

    // Розбираємо посилання: https://t.me/tsnug/12345 -> беремо tsnug/12345
    const linkParts = newsItem.link.split('t.me/');
    
    if (linkParts.length > 1) {
        const postAddress = linkParts[1];

        // Створюємо скрипт віджета динамічно
        const script = document.createElement('script');
        script.async = true;
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute('data-telegram-post', postAddress);
        script.setAttribute('data-width', '100%');
        // Адаптація під тему
        script.setAttribute('data-color', tg.colorScheme === 'dark' ? '292929' : 'FFFFFF');
        script.setAttribute('data-dark', tg.colorScheme === 'dark' ? '1' : '0');
        script.setAttribute('data-userpic', 'false'); // Ховаємо аватарку каналу, щоб економити місце

        // Очищаємо контейнер і вставляємо скрипт
        widgetContainer.innerHTML = '';
        widgetContainer.appendChild(script);
    } else {
        widgetContainer.innerHTML = '<p style="color:red">Не вдалося відкрити пост</p>';
    }

    document.getElementById('news-modal').classList.add('active');
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    // Очищаємо віджет, щоб відео зупинилось
    document.getElementById('telegram-widget-container').innerHTML = '';
    tg.BackButton.hide();
    tg.BackButton.offClick(closeModal);
}

// Запуск
const options = { weekday: 'long', month: 'long', day: 'numeric' };
const today = new Date().toLocaleDateString('uk-UA', options);
document.getElementById('current-date').innerText = today.charAt(0).toUpperCase() + today.slice(1);

loadNews();
