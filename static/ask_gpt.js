function get_ip_by_place_code(){
    switch (config.CONNECTION_PLACE_ID){
        case 1:
            return "192.168.1.139"
        case 2:
            return "10.10.10.127"
        case 3:
            return "192.168.1.25"
        default:
            return "192.168.1.6"
    }
}

async function askHF(product, token) {
    try {
        const response = await fetch(
            `https://${get_ip_by_place_code()}/hf-proxy.php?product=${encodeURIComponent(product)}&token=${token}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Error fetching data:", error);
        return { error: error.message };
    }
}

async function parse_russian_db(code) {
    try {
        const response = await fetch(`https://${get_ip_by_place_code()}/barcode-proxy.php?code=${code}`);
        const data = await response.json();
        if (data.product.startsWith("Поиск"))
        {
            return "Товар не найден"
        }
        return data.product || 'Товар не найден';
    } catch (err) {
        console.error('Ошибка:', err);
        return `ERROR: ${err}`;
    }
}


async function parse_similar(product)
{
    try{
        const response = await fetch(`https://${get_ip_by_place_code()}/open_food_facts-proxy.php?product=${product}`);
        const data = await response.json();
        return data || 'Товар не найден';
    } catch (err) {
        console.error('Ошибка:', err);
        return `ERROR: err`;
    }    
}


async function getSiteTitle(url) {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      return titleMatch ? titleMatch[1] : "Title not found";
    } catch (error) {
      console.error("Ошибка:", error);
      return null;
    }
  }