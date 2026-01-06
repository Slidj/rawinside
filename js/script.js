const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

const CHANNEL_USERNAME = 'rawinside_news'; 

// Джерела, які віддають ПОВНИЙ текст (Full Text)
const RSS_URLS = [
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (DIRECT XML via CODETABS)
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    // Анти-кеш: змінюємо цифру раз на 5 хвилин.
    // Це дозволяє бачити нові новини, але не "злить" сервер частими запитами.
    const safeTimestamp = Math.floor(Date.now() / 300000); 

    let success = false;

    for (let i = 0; i < RSS_URLS.length; i++) {
        if (success) break;

        // CodeTabs - це дуже надійний проксі, який рідко блокує
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(RSS_URLS[i])}&dummy=${safeTimestamp}`;

        try {
            const response = await fetch(proxyUrl);
            const strXML = await response.text();
            
            // Перевіряємо, чи це XML
            if (!strXML.includes('<?xml') && !strXML.includes('<rss')) {
                throw new Error('Not XML');
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(strXML, "text/xml");
            
            const items = xmlDoc.querySelectorAll("item");

            if (items.length > 0) {
                container.innerHTML = ''; 
                items.forEach(item => {
                    try {
                        const parsedItem = parseXMLPost(item);
                        if (parsedItem) createCard(parsedItem);
                    } catch (e) { console.error(e); }
                });
                
                if (!isBackground) tg.HapticFeedback.notificationOccurred('success');
                success = true;
                return; 
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} пропущено.`);
        }
    }

    if (!success && !isBackground) {
        container.innerHTML = `
            <div class="error">
                <p>Не вдалося завантажити новини</p>
                <small style="opacity:0.5">Всі канали перевантажені</small>
            </div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// Запуск
loadNews(false);
// Авто-оновлення раз на 5 хвилин (щоб напевно не заблокували)
setInterval(() => { loadNews(true); }, 300000); 


// ==========================================
// 🧠 ПАРСЕР XML (ПОВНИЙ ТЕКСТ)
// ==========================================

function parseXMLPost(xmlItem) {
    // Функція для витягування тексту з тегу
    const getTag = (name) => {
        const el = xmlItem.querySelector(name);
        return el ? (el.textContent || el.innerHTML) : "";
    };

    let title = getTag("title");
    let link = getTag("link");
    let pubDate = getTag("pubDate");
    
    // 🔥 ГОЛОВНЕ: Отримуємо повний опис 🔥
    // У Telegram RSS весь текст лежить у <description>
    let rawDescription = getTag("description");
    
    // Очищаємо HTML, щоб дістати чистий текст для перевірок, 
    // але зберігаємо оригінал для модалки (щоб були абзаци)
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawDescription;

    let imageSrc = null;
    let videoSrc = null;

    // --- 1. ПОШУК МЕДІА (ENCLOSURE) ---
    const enclosures = xmlItem.querySelectorAll("enclosure");
    enclosures.forEach(enc => {
        const type = enc.getAttribute("type");
        const url = enc.getAttribute("url");
        if (type && type.includes("video") && !videoSrc) videoSrc = url;
        if (type && type.includes("image") && !imageSrc) imageSrc = url;
    });

    // --- 2. ПОШУК МЕДІА (HTML) ---
    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }
    if (!imageSrc) {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }
    
    // Regex для картинок в тексті
    if (!imageSrc) {
        const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|webp))/i;
        const match = rawDescription.match(imgRegex);
        if (match) imageSrc = match[1];
    }

    // Заглушки
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Проксі зображень
    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // --- 3. ОБРОБКА ТЕКСТУ ---
    
    // Для повного тексту беремо те, що в tempDiv (там текст без HTML тегів <video>, але з форматуванням)
    // Але нам треба прибрати зайві переноси рядків на початку
    let fullText = tempDiv.innerText.trim();
    
    // Якщо тексту немає, ставимо заглушку
    if (!fullText || fullText.length < 2) {
        if (videoSrc) fullText = "Дивіться відео у повному вікні.";
        else fullText = "Новина без текстового опису.";
    }

    // Прибираємо [Video], [Image] на початку
    fullText = fullText.replace(/^\[[^\]]+\]\s*/, '');

    // Формуємо короткий заголовок (4 слова) для картки
    // Але якщо оригінальний заголовок (title) не "Новина" і не посилання, беремо його
    let shortTitle = title;
    if (!shortTitle || shortTitle.includes('http') || shortTitle.length < 3) {
        let words = fullText.split(/\s+/);
        shortTitle = words.slice(0, 4).join(' ');
        if (words.length > 4) shortTitle += "...";
    }

    // Дата
    const dateObj = new Date(pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

    return {
        title: shortTitle, 
        full: fullText,  // Тут тепер повний текст
        image: imageSrc,
        video: videoSrc, 
        date: dateStr,
        link: link
    };
}

// ==========================================
// 🎨 КАРТКА
// ==========================================

function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    card.onclick = () => openModal(newsItem);

    const playOverlay = newsItem.video ? '<div class="play-icon-overlay"></div>' : '';

    card.innerHTML = `
        <div class="card-media-wrapper">
            <img src="${newsItem.image}" class="card-media" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
            ${playOverlay}
        </div>
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <div class="card-meta">${newsItem.date}</div>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 🎬 ПЛЕЄР
// ==========================================

function openModal(newsItem) {
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = ''; 

    if (newsItem.video) {
        const video = document.createElement('video');
        video.className = 'app-video';
        video.src = newsItem.video;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true; 
        video.loop = true;
        video.controls = true; 
        
        video.onerror = () => {
            mediaContainer.innerHTML = ''; 
            const fallbackImg = document.createElement('img');
            fallbackImg.className = 'app-image';
            fallbackImg.src = newsItem.image;
            mediaContainer.appendChild(fallbackImg);
            const msg = document.createElement('p');
            msg.style.color = '#aaa';
            msg.style.textAlign = 'center';
            msg.style.marginTop = '10px';
            msg.innerText = '(Відео доступне в каналі)';
            mediaContainer.appendChild(msg);
        };
        mediaContainer.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.className = 'app-image';
        img.src = newsItem.image;
        mediaContainer.appendChild(img);
    }

    document.getElementById('modal-title').innerText = newsItem.title; 
    document.getElementById('modal-date').innerText = newsItem.date;
    
    // Використовуємо innerText для безпеки, але зберігаємо переноси рядків
    document.getElementById('modal-text').innerText = newsItem.full;
    
    document.getElementById('modal-link').href = newsItem.link;

    document.getElementById('news-modal').classList.add('active');
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    setTimeout(() => { document.getElementById('media-container').innerHTML = ''; }, 300);
    tg.BackButton.hide();
}
