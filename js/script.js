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
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ (XML PARSER)
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    if (!isBackground) {
        container.innerHTML = '<div class="loading">Завантаження стрічки...</div>';
    }

    // Додаємо випадкове число, щоб проксі не кешував запит
    const cacheBuster = Date.now();

    for (let i = 0; i < RSS_URLS.length; i++) {
        // 🔥 ВИКОРИСТОВУЄМО ПРЯМИЙ ПРОКСІ (AllOrigins) 🔥
        // Це дозволяє отримати чистий XML без кешування rss2json
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URLS[i])}&rand=${cacheBuster}`;

        try {
            const response = await fetch(proxyUrl);
            const strXML = await response.text();
            
            // Перетворюємо текст у XML-документ
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(strXML, "text/xml");
            
            // Шукаємо всі елементи <item> (новини)
            const items = xmlDoc.querySelectorAll("item");

            if (items.length > 0) {
                container.innerHTML = ''; // Чистимо екран
                
                // Перебираємо новини
                items.forEach(item => {
                    try {
                        const parsedItem = parseXMLPost(item);
                        if (parsedItem) createCard(parsedItem);
                    } catch (err) {
                        console.error("Помилка парсингу поста", err);
                    }
                });
                
                if (!isBackground) tg.HapticFeedback.notificationOccurred('success');
                return; // Успіх! Виходимо.
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} не спрацювало.`);
        }
    }

    if (!isBackground) {
        container.innerHTML = `
            <div class="error">
                <p>Немає зв'язку з каналом</p>
                <small style="opacity:0.5">Спробуйте пізніше</small>
            </div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// Запуск (оновлення кожні 2 хвилини)
loadNews(false);
setInterval(() => { loadNews(true); }, 120000); 


// ==========================================
// 🧠 ПАРСЕР XML (НОВА ЛОГІКА)
// ==========================================

function parseXMLPost(xmlItem) {
    // 1. Отримуємо базові поля з XML
    const titleNode = xmlItem.querySelector("title");
    const descNode = xmlItem.querySelector("description");
    const linkNode = xmlItem.querySelector("link");
    const pubDateNode = xmlItem.querySelector("pubDate");
    const enclosureNode = xmlItem.querySelector("enclosure");

    let rawDesc = descNode ? (descNode.textContent || descNode.innerHTML) : "";
    let itemTitle = titleNode ? titleNode.textContent : "Новина";
    let itemLink = linkNode ? linkNode.textContent : "#";
    let itemDate = pubDateNode ? new Date(pubDateNode.textContent) : new Date();

    let imageSrc = null;
    let videoSrc = null;

    // Створюємо тимчасовий елемент для аналізу HTML всередині опису
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawDesc;

    // --- 2. ПОШУК МЕДІА ---

    // А) Перевіряємо enclosure (вкладення в XML)
    if (enclosureNode) {
        const type = enclosureNode.getAttribute("type");
        const url = enclosureNode.getAttribute("url");
        
        if (type && type.includes("video")) videoSrc = url;
        if (type && type.includes("image")) imageSrc = url;
    }

    // Б) Якщо немає, шукаємо в HTML опису
    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }

    if (!imageSrc) {
        let imgTag = tempDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }

    // В) Регулярний вираз як остання надія для картинок
    if (!imageSrc) {
        const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|webp))/i;
        const match = rawDesc.match(imgRegex);
        if (match) imageSrc = match[1];
    }

    // Заглушки
    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    // Проксіювання картинки
    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    // --- 3. ОБРОБКА ТЕКСТУ ---
    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.trim();

    // Якщо тексту немає
    if (!cleanText) {
        cleanText = videoSrc ? "Відео новина" : "Фото новина";
    }

    // Чистимо від тегів [Video]
    cleanText = cleanText.replace(/^\[[^\]]+\]\s*/, '');

    // Короткий заголовок
    let words = cleanText.split(/\s+/);
    let shortTitle = words.slice(0, 4).join(' ');
    if (words.length > 4) shortTitle += "...";

    // Форматування дати
    const dateStr = itemDate.toLocaleDateString('uk-UA', { 
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
    });

    return {
        title: shortTitle, 
        full: cleanText,  
        image: imageSrc,
        video: videoSrc, 
        date: dateStr,
        link: itemLink
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
