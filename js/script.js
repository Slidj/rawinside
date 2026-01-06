const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

const CHANNEL_USERNAME = 'rawinside_news'; 

// Використовуємо надійні дзеркала
const RSS_URLS = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (ЧЕРЕЗ ПРОКСІ ALLORIGINS)
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    // Додаємо число, щоб браузер не кешував
    const cacheBuster = Date.now();

    for (let i = 0; i < RSS_URLS.length; i++) {
        // Використовуємо AllOrigins - це безкоштовний проксі без лімітів ключів
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(RSS_URLS[i])}&rand=${cacheBuster}`;

        try {
            const response = await fetch(proxyUrl);
            const data = await response.json(); // Отримуємо JSON обгортку

            if (data.contents) {
                // data.contents - це чистий XML текст RSS стрічки
                const xmlStr = data.contents;
                
                // Парсимо XML вручну (це найнадійніший метод)
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
                const items = xmlDoc.querySelectorAll("item");

                if (items.length > 0) {
                    container.innerHTML = ''; 
                    
                    items.forEach(item => {
                        try {
                            const parsedItem = parseXMLPost(item);
                            if (parsedItem) createCard(parsedItem);
                        } catch (err) {
                            console.error("Помилка парсингу:", err);
                        }
                    });
                    
                    if (!isBackground) tg.HapticFeedback.notificationOccurred('success');
                    return; // Успіх!
                }
            }
        } catch (e) {
            console.warn(`Проксі для дзеркала ${i} не відповів.`);
        }
    }

    if (!isBackground) {
        container.innerHTML = `
            <div class="error">
                <p>Немає з'єднання</p>
                <small style="opacity:0.5">Всі сервери зайняті</small>
            </div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// Оновлення кожні 2 хвилини
loadNews(false);
setInterval(() => { loadNews(true); }, 120000); 


// ==========================================
// 🧠 ПАРСЕР XML (СУПЕР-ТОЧНИЙ)
// ==========================================

function parseXMLPost(xmlItem) {
    // 1. Витягуємо дані з XML тегів
    const getTag = (tag) => {
        const el = xmlItem.querySelector(tag);
        return el ? (el.textContent || el.innerHTML) : "";
    };

    let title = getTag("title");
    let link = getTag("link");
    let pubDate = getTag("pubDate");
    let description = getTag("description");

    let imageSrc = null;
    let videoSrc = null;

    // Створюємо HTML елемент для аналізу опису
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = description;

    // --- 2. ПОШУК МЕДІА (АЛЬБОМИ + ВІДЕО) ---
    
    // В XML enclosures можуть дублюватись. Беремо всі.
    const enclosures = xmlItem.querySelectorAll("enclosure");
    
    // Проходимо по всіх вкладеннях
    enclosures.forEach(enc => {
        const type = enc.getAttribute("type");
        const url = enc.getAttribute("url");
        
        if (type && type.includes("video") && !videoSrc) videoSrc = url;
        if (type && type.includes("image") && !imageSrc) imageSrc = url;
    });

    // Якщо в enclosure пусто, шукаємо в HTML
    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }

    if (!imageSrc) {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }

    // Регулярний вираз для картинок (остання надія)
    if (!imageSrc) {
        const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|webp))/i;
        const match = description.match(imgRegex);
        if (match) imageSrc = match[1];
    }

    // Заглушки
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Проксі для картинок
    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // --- 3. ТЕКСТ ---
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();
    
    if (!cleanText) {
        if (videoSrc) cleanText = "Відео новина";
        else if (imageSrc !== DEFAULT_IMAGE) cleanText = "Фото новина";
        else cleanText = "Новина";
    }

    cleanText = cleanText.replace(/^\[[^\]]+\]\s*/, '');
    
    let words = cleanText.split(/\s+/);
    let shortTitle = words.slice(0, 4).join(' ');
    if (words.length > 4) shortTitle += "...";

    // Дата
    const dateObj = new Date(pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

    return {
        title: shortTitle, 
        full: cleanText,  
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
