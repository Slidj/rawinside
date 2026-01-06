const tg = window.Telegram.WebApp;
tg.expand();

// Налаштування кольорів
if (tg.colorScheme === 'light') {
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#000000';
}

// ==========================================
// ⚙️ НАЛАШТУВАННЯ
// ==========================================

// Впиши сюди юзернейм ТВОГО каналу (без @)
// Спробуй створити свій канал, написати туди пост і вписати сюди його юзернейм.
// Офіційний канал 'telegram' занадто великий і часто викликає помилки у безкоштовних парсерів.
const CHANNEL_USERNAME = 'telegram'; 

// Список сервісів (дзеркал), які ми будемо пробувати по черзі
const RSS_SERVICES = [
    `https://rsshub.app/telegram/channel/${CHANNEL_USERNAME}`, // Варіант 1 (Найпопулярніший)
    `https://openrss.org/t.me/${CHANNEL_USERNAME}`,            // Варіант 2 (Той, що був)
    `https://tg.i-c-a.su/rss/${CHANNEL_USERNAME}`              // Варіант 3 (Резервний)
];

// ==========================================
// 🚀 ЗАВАНТАЖЕННЯ НОВИН (РОЗУМНЕ)
// ==========================================

async function loadNews() {
    const container = document.getElementById('news-feed');
    container.innerHTML = '<div class="loading">🔄 Підключення до каналу...</div>';

    // Пробуємо сервіси по черзі
    for (let i = 0; i < RSS_SERVICES.length; i++) {
        const rssUrl = RSS_SERVICES[i];
        // Формуємо посилання для конвертера rss2json
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

        try {
            console.log(`Спроба #${i + 1}: ${rssUrl}`);
            const response = await fetch(apiUrl);
            const data = await response.json();

            // Якщо успішно отримали дані
            if (data.status === 'ok' && data.items.length > 0) {
                container.innerHTML = ''; // Очищаємо "Завантаження..."
                
                data.items.forEach(item => {
                    const parsedItem = parseTelegramPost(item);
                    if (parsedItem) createCard(parsedItem);
                });
                return; // Виходимо з функції, бо все вийшло!
            }
        } catch (error) {
            console.warn(`Сервіс ${i + 1} не відповів.`);
        }
    }

    // Якщо ми тут - значить жоден сервіс не спрацював
    container.innerHTML = `
        <div class="error" style="text-align:center; padding:20px; color:#ef4444;">
            <h3>😔 Не вдалося завантажити</h3>
            <p>Канал <b>@${CHANNEL_USERNAME}</b> недоступний через API.</p>
            <p>1. Перевір, чи канал публічний.<br>2. Напиши туди новий пост (текст+фото).<br>3. Спробуй змінити 'telegram' на свій канал.</p>
        </div>
    `;
}

// ==========================================
// 🧠 ОБРОБКА ДАНИХ
// ==========================================

function parseTelegramPost(item) {
    // 1. Шукаємо картинку
    // Різні сервіси віддають картинку по-різному, шукаємо всюди
    const imgRegex = /src="([^"]+)"/;
    let imgMatch = item.description.match(imgRegex);
    
    // Якщо в описі немає, перевіряємо поле enclosure (стандарт RSS)
    let imageSrc = imgMatch ? imgMatch[1] : (item.enclosure?.link || null);
    
    // Заглушка
    if (!imageSrc) imageSrc = 'https://placehold.co/600x400/2a2a2e/FFF?text=News';

    // 2. Чистимо текст
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.description;
    let cleanText = tempDiv.innerText || tempDiv.textContent || "";
    cleanText = cleanText.trim();

    // Якщо пост порожній і без картинки - пропускаємо
    if (!cleanText && imageSrc.includes('placehold')) return null;
    if (!cleanText) cleanText = "Новина без тексту (тільки фото)...";

    // 3. Дата
    const dateObj = new Date(item.pubDate);
    const dateStr = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    const timeStr = dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    return {
        title: item.title && item.title.length < 50 && !item.title.includes('http') ? item.title : "Новина каналу",
        short: cleanText.substring(0, 100) + (cleanText.length > 100 ? "..." : ""),
        full: cleanText,
        image: imageSrc,
        date: `${dateStr}, ${timeStr}`,
        link: item.link,
        tag: "NEWS"
    };
}

// ==========================================
// 🎨 ІНТЕРФЕЙС
// ==========================================

function createCard(newsItem) {
    const container = document.getElementById('news-feed');
    const card = document.createElement('div');
    card.className = 'news-card';
    card.onclick = () => openModal(newsItem);

    card.innerHTML = `
        <img src="${newsItem.image}" alt="" class="card-thumb" onerror="this.style.display='none'">
        <div class="card-content">
            <div class="card-title">${newsItem.title}</div>
            <p class="card-desc">${newsItem.short}</p>
            <span class="card-time">${newsItem.date}</span>
        </div>
    `;
    container.appendChild(card);
}

// ==========================================
// 📱 МОДАЛЬНЕ ВІКНО
// ==========================================

function openModal(newsItem) {
    const modalImg = document.getElementById('modal-img');
    modalImg.src = newsItem.image;
    modalImg.style.display = newsItem.image.includes('placehold') ? 'none' : 'block';

    document.getElementById('modal-tag').innerText = newsItem.tag;
    document.getElementById('modal-date').innerText = newsItem.date;
    document.getElementById('modal-title').innerText = newsItem.title;
    document.getElementById('modal-text').innerText = newsItem.full;
    document.getElementById('modal-link').href = newsItem.link;

    document.getElementById('news-modal').classList.add('active');
    tg.HapticFeedback.impactOccurred('light');
    tg.BackButton.show();
    tg.BackButton.onClick(closeModal);
}

function closeModal() {
    document.getElementById('news-modal').classList.remove('active');
    tg.BackButton.hide();
    tg.BackButton.offClick(closeModal);
}

// ==========================================
// 🚀 ЗАПУСК
// ==========================================
const options = { weekday: 'long', month: 'long', day: 'numeric' };
const today = new Date().toLocaleDateString('uk-UA', options);
document.getElementById('current-date').innerText = today.charAt(0).toUpperCase() + today.slice(1);

loadNews();
  
