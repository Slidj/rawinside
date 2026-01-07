const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

document.body.style.backgroundColor = '#0a0e17';

const CHANNEL_USERNAME = 'rawinside_news'; 
const DEFAULT_IMAGE = 'https://placehold.co/800x400/141e30/ffffff?text=INSIDE';

const RSS_URLS = [
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`,
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`
];

// 🔥 ГЛОБАЛЬНІ ЗМІННІ ДЛЯ СКРОЛУ 🔥
let ALL_NEWS = [];        
let CURRENT_INDEX = 0;    
const BATCH_SIZE = 10;    

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ ДАНИХ
// ==========================================

async function loadNews(isBackground = false) {
    const container = document.getElementById('news-feed');
    
    if (!isBackground) {
        ALL_NEWS = [];
        CURRENT_INDEX = 0;
        container.innerHTML = '<div class="loader-container"><span class="loader"></span></div>';
    }

    const safeTimestamp = Math.floor(Date.now() / 300000); 
    let success = false;

    for (let i = 0; i < RSS_URLS.length; i++) {
        if (success) break;

        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(RSS_URLS[i])}&dummy=${safeTimestamp}`;

        try {
            const response = await fetch(proxyUrl);
            const strXML = await response.text();
            
            if (!strXML.includes('<?xml') && !strXML.includes('<rss')) throw new Error('Not XML');

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(strXML, "text/xml");
            const items = xmlDoc.querySelectorAll("item");

            if (items.length > 0) {
                const tempArray = [];
                items.forEach(item => {
                    try {
                        const parsedItem = parseXMLPost(item);
                        if (parsedItem) tempArray.push(parsedItem);
                    } catch (e) { console.error(e); }
                });

                ALL_NEWS = tempArray;
                
                if (!isBackground) container.innerHTML = '';
                renderNextBatch();
                
                if (!isBackground) tg.HapticFeedback.notificationOccurred('success');
                success = true;
            }
        } catch (e) {
            console.warn(`Дзеркало ${i} пропущено.`);
        }
    }

    if (!success && !isBackground) {
        container.innerHTML = `<div class="error"><p>Не вдалося завантажити новини</p></div>`;
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// ==========================================
// 📦 ЛОГІКА ПОРЦІЙ
// ==========================================

function renderNextBatch() {
    const container = document.getElementById('news-feed');
    if (CURRENT_INDEX >= ALL_NEWS.length) return;

    const nextBatch = ALL_NEWS.slice(CURRENT_INDEX, CURRENT_INDEX + BATCH_SIZE);
    
    nextBatch.forEach((newsItem, index) => {
        createCard(newsItem, index);
    });

    CURRENT_INDEX += nextBatch.length;
}

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        renderNextBatch();
    }
}, { rootMargin: '100px' });

const scrollGuard = document.getElementById('scroll-guard');
if (scrollGuard) observer.observe(scrollGuard);


// ==========================================
// 🧠 ПАРСЕР XML
// ==========================================

function parseXMLPost(xmlItem) {
    const getTag = (name) => {
        const el = xmlItem.querySelector(name);
        return el ? (el.textContent || el.innerHTML) : "";
    };

    let title = getTag("title");
    let link = getTag("link");
    let pubDate = getTag("pubDate");
    let rawDescription = getTag("description");
    
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawDescription;
    tempDiv.querySelectorAll('a').forEach(a => a.remove());
    tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n')); 

    let cleanText = tempDiv.innerText || "";
    cleanText = cleanText.replace(/^(?:\[[^\]]*\]\s*)+/g, '');
    cleanText = cleanText.replace(/\[Video\]/gi, '').replace(/\[Photo\]/gi, '').replace(/\[Album\]/gi, '');
    cleanText = cleanText.trim();

    let imageSrc = null;
    let videoSrc = null;

    const enclosures = xmlItem.querySelectorAll("enclosure");
    enclosures.forEach(enc => {
        const type = enc.getAttribute("type");
        const url = enc.getAttribute("url");
        if (type && type.includes("video") && !videoSrc) videoSrc = url;
        if (type && type.includes("image") && !imageSrc) imageSrc = url;
    });

    if (!videoSrc) {
        let videoTag = tempDiv.querySelector('video');
        if (videoTag && videoTag.src) videoSrc = videoTag.src;
    }
    if (!imageSrc) {
        let rawDiv = document.createElement("div");
        rawDiv.innerHTML = rawDescription;
        let imgTag = rawDiv.querySelector('img');
        if (imgTag) imageSrc = imgTag.src;
    }
    if (!imageSrc) {
        const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|webp))/i;
        const match = rawDescription.match(imgRegex);
        if (match) imageSrc = match[1];
    }

    if (videoSrc && !imageSrc) imageSrc = DEFAULT_IMAGE;
    if (!imageSrc) imageSrc = DEFAULT_IMAGE;

    if (imageSrc !== DEFAULT_IMAGE && !imageSrc.includes('wsrv.nl')) {
        imageSrc = `https://wsrv.nl/?url=${encodeURIComponent(imageSrc)}&w=600&output=jpg`;
    }

    if (!cleanText) {
        if (videoSrc) cleanText = "Відео новина";
        else if (imageSrc !== DEFAULT_IMAGE) cleanText = "Фото новина";
        else cleanText = "Новина";
    }

    let words = cleanText.split(/\s+/);
    let shortTitle = words.slice(0, 4).join(' ');
    if (words.length > 4) shortTitle += "...";

    const dateObj = new Date(pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

    return {
        title: shortTitle, full: cleanText, image: imageSrc, video: videoSrc, date: dateStr, link: link
    };
}

// ==========================================
// 🎨 КАРТКА (З БЕЙДЖЕМ)
// ==========================================

function createCard(newsItem, index) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    card.style.animationDelay = `${index * 0.1}s`;
    card.onclick = () => openModal(newsItem);

    const playOverlay = newsItem.video ? '<div class="play-icon-overlay"></div>' : '';

    // 🔥 ДОДАНО БЕЙДЖ "NEWS INSIDE" 🔥
    card.innerHTML = `
        <div class="card-media-wrapper">
            <img src="${newsItem.image}" class="card-media" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
            ${playOverlay}
        </div>
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <div class="card-meta">${newsItem.date}</div>
        </div>
        
        <div class="card-badge">
            <span class="b-news">NEWS</span>
            <span class="b-inside">INSIDE</span>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 🎬 МОДАЛКА
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

loadNews(false);
setInterval(() => { loadNews(true); }, 300000); 
