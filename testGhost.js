

const siteUrl = 'https://blog.nami.exchange';
const contentApiKey = 'bafd2bfa46387a4f2ce13c7ea0';
async function fetchAllPosts() {
  const perPage = 100; // max per request
  let page = 1;
  let allPosts = [];
  let totalPages = 1;
  do {
    const url = `${siteUrl}/ghost/api/content/posts/?key=${contentApiKey}&limit=${perPage}&page=${page}&filter=visibility:public`;
    const response = await fetch(url);
    const data = await response.json();
    allPosts = allPosts.concat(data.posts);
    totalPages = data.meta.pagination.pages;
    page += 1;
  } while (page <= totalPages);
  return allPosts;
}
fetchAllPosts()
  .then(posts => {
    console.log(`Fetched ${posts.length} published posts.`);
    // console.log(posts);
  })
  .catch(error => {
    console.error('Error fetching posts:', error);
  });



async function get_nami_news(query_type = 'latest') { // query_type có thể là 'latest', 'trending', 'campaigns'
    console.log(`Calling Nami News API for type: ${query_type}`);
    try {
        // Đây là ví dụ cho Ghost Content API. Bạn cần cấu hình đúng endpoint và API Key.
        // Hoặc bạn có thể tạo dữ liệu giả lập như ví dụ bên dưới
        const response = await axios.get(`${NAMI_NEWS_API_BASE_URL}/posts`, {
            params: {
                key: NAMI_NEWS_API_KEY,
                limit: 1, // Lấy 1 bài mới nhất
                fields: 'title,slug,html,url,published_at,custom_excerpt' // Lấy các trường cần thiết
            }
        });

        const post = response.data.posts[0]; // Lấy bài đăng đầu tiên

        if (!post) {
            return { error: `Không tìm thấy tin tức/bài đăng nào cho loại ${query_type}.` };
        }

        // Chuyển đổi HTML sang văn bản thuần túy và làm sạch
        const textContent = convert(post.html, {
            wordwrap: 130,
            selectors: [{ selector: 'a', options: { ignoreHref: true } }] // Bỏ qua link trong nội dung
        });

        // Tóm tắt nội dung chính (có thể dùng LLM nhỏ để tóm tắt nếu nội dung quá dài)
        // Hiện tại, chúng ta sẽ chỉ lấy đoạn đầu hoặc custom_excerpt
        const summary = post.custom_excerpt || textContent.substring(0, 300) + '...';

        let formattedNews = `**Tin tức từ Nami Exchange:**\n\n`;
        formattedNews += `**Tiêu đề:** ${post.title}\n`;
        formattedNews += `**Xuất bản vào:** ${new Date(post.published_at).toLocaleDateString('vi-VN')}\n`;
        formattedNews += `**Tóm tắt:** ${summary}\n`;
        formattedNews += `**Đọc thêm:** ${post.url}\n\n`;

        // Thêm logic để tìm kiếm chiến dịch/khuyến mãi nếu query_type là 'campaigns'
        // Đây có thể là một bước phức tạp hơn, có thể cần LLM để tìm kiếm từ khóa trong `textContent`
        if (query_type === 'campaigns') {
            const campaignKeywords = ['campaign', 'promo', 'offer', 'ưu đãi', 'khuyến mãi', 'giải đấu'];
            const foundCampaign = campaignKeywords.some(keyword => textContent.toLowerCase().includes(keyword));
            if (!foundCampaign) {
                formattedNews += `Lưu ý: Không tìm thấy thông tin chiến dịch/khuyến mãi rõ ràng trong bài đăng này.\n`;
            } else {
                 formattedNews += `Bài đăng này có liên quan đến các chiến dịch/khuyến mãi.\n`;
            }
        }
        
        return {
            source: "Nami Blog",
            news_summary: formattedNews,
            full_post_url: post.url,
            raw_data: post // Giữ raw data để debug
        };

    } catch (error) {
        console.error(`Lỗi khi lấy tin tức Nami (type: ${query_type}):`, error.response?.data || error.message);
        return { error: `Không thể lấy tin tức/blog từ Nami lúc này. Vui lòng thử lại sau.` };
    }
}