const axios = require('axios');
require('dotenv').config();


async function get_nami_notification_setting_internal(lang = 'vi') { // Đổi tên để tránh nhầm lẫn
    console.log(`Lấy cài đặt thông báo cho người dùng.`);
    try {
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return {
                error: (lang === 'vi') ? "Không thể truy cập cài đặt thông báo. Vui lòng cung cấp token xác thực." : "Cannot access notification settings. Authentication token is missing."
            };
        }

        const response = await axios.get(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/alert_price/setting`, {
            headers: {
                'fakeauthorization': process.env.NAMI_USER_AUTH_TOKEN
            }
        });

        if (response.data.status === 'ok' && response.data.data) {
            const settings = response.data.data;
            console.log(settings)
            return {
                success: true,
                useDeviceNoti: settings.deviceNoti,
                emailNoti: settings.emailNoti,
                lang: settings.lang || 'vi'
            };
        } else {
            return { error: (lang === 'vi') ? "Không thể lấy cài đặt thông báo hiện tại." : "Unable to retrieve current notification settings." };
        }
    } catch (error) {
        console.error(`Lỗi khi lấy cài đặt thông báo:`, error.response?.data || error.message);
        return { error: (lang === 'vi') ? "Không thể lấy cài đặt thông báo lúc này. Vui lòng thử lại sau." : "Unable to retrieve notification settings at this time." };
    }
}

// get_nami_notification_setting_internal('vi').then(r=> console.log(r))
// Hàm để cập nhật cài đặt thông báo của người dùng
async function update_nami_notification_setting(useDeviceNoti, useEmailNoti, lang = 'vi') {
    console.log(`Cập nhật cài đặt thông báo: useDeviceNoti=${useDeviceNoti}, useEmailNoti=${useEmailNoti}`);
    try {
        if (!process.env.NAMI_USER_AUTH_TOKEN) {
            return {
                error: (lang === 'vi') ? "Không thể cập nhật cài đặt thông báo. Vui lòng cung cấp token xác thực." : "Cannot update notification settings. Authentication token is missing."
            };
        }

        const payload = {
            useDeviceNoti: useDeviceNoti,
            useEmailNoti: useEmailNoti
        };

        const response = await axios.put(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/alert_price/setting`, payload, {
            headers: {
                'fakeauthorization': process.env.NAMI_USER_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.status === 'ok') {
            return {
                success: true,
                message: (lang === 'vi') ?
                    `Cài đặt thông báo của bạn đã được cập nhật thành công: Thông báo trên thiết bị ${useDeviceNoti ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}, Thông báo Email ${useEmailNoti ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}.` :
                    `Your notification settings have been updated successfully: Device notifications ${useDeviceNoti ? 'ENABLED' : 'DISABLED'}, Email notifications ${useEmailNoti ? 'ENABLED' : 'DISABLED'}.`
            };
        } else {
            return { error: (lang === 'vi') ? "Không thể cập nhật cài đặt thông báo." : "Unable to update notification settings." };
        }
    } catch (error) {
        console.error(`Lỗi khi cập nhật cài đặt thông báo:`, error.response?.data || error.message);
        return { error: (lang === 'vi') ? "Không thể cập nhật cài đặt thông báo lúc này. Vui lòng thử lại sau." : "Unable to update notification settings at this time." };
    }
}


// MODIFIED: create_nami_alert sẽ tự động kiểm tra và gợi ý
async function create_nami_alert(alert_type, base_assets, quote_asset='USDT', product_type='SPOT', value = null, percentage_change = null, interval = null, frequency = 'ONLY_ONCE', lang = 'vi') {
    console.log(`Tạo cảnh báo Nami: type=${alert_type}, assets=${base_assets.join(',')}, quote=${quote_asset}, product=${product_type}, value=${value}, pct_change=${percentage_change}, interval=${interval}, freq=${frequency}, lang=${lang}`);

    if (!process.env.NAMI_USER_AUTH_TOKEN) {
        return { error: (lang === 'vi') ? "Không thể tạo cảnh báo. ID người dùng Nami chưa được cấu hình." : "Cannot create alert. Nami User ID is not configured." };
    }
    const translatedAlertTypes = {
        'REACH_PRICE': { vi: 'đạt đến giá', en: 'reach the price' },
        'PRICE_RISES_ABOVE': { vi: 'tăng lên trên', en: 'rise above' },
        'PRICE_DROPS_TO': { vi: 'giảm xuống dưới', en: 'drop below' },
        'CHANGE_IS_OVER': { vi: 'tăng trên một ngưỡng', en: 'change over a threshold' },
        'CHANGE_IS_UNDER': { vi: 'giảm dưới một ngưỡng', en: 'change under a threshold' },
        'DAY_CHANGE_IS_OVER': { vi: 'biến động 24h tăng trên', en: '24h change over' },
        'DAY_CHANGE_IS_DOWN': { vi: 'biến động 24h giảm xuống', en: '24h change down' },
        'DURATION_CHANGE_IS_OVER': { vi: 'biến động trong khoảng thời gian tăng trên', en: 'duration change over' },
        'DURATION_CHANGE_IS_UNDER': { vi: 'biến động trong khoảng thời gian giảm dưới', en: 'duration change under' },
        'DURATION_CHANGE': { vi: 'biến động trong khoảng thời gian', en: 'duration change' }
    };
    const translatedAlertType = translatedAlertTypes[alert_type] ? translatedAlertTypes[alert_type][lang] : alert_type;

    let valueDisplay = '';
    if (alert_type.includes('PRICE')) {
        const currencySymbol = (quote_asset === 'USDT') ? '$' : ((quote_asset === 'VNST') ? ' VNST' : '');
        valueDisplay = `${currencySymbol}${value}`;
    } else if (alert_type.includes('CHANGE') || alert_type.includes('DURATION')) {
        valueDisplay = `${percentage_change}%`;
    }
    if (interval !== null && (alert_type.includes('DURATION'))) {
        valueDisplay += ` ${(lang === 'vi' ? 'trong' : 'in')} ${interval} ${(lang === 'vi' ? 'giờ' : 'hours')}`;
    }

    let payload = {
        baseAsset: base_assets[0],
        baseAssets: base_assets,
        isMulti: base_assets.length > 1,
        quoteAsset: quote_asset,
        productType: product_type,
        alertType: alert_type,
        frequency: frequency,
        lang: lang
    };

    if (value !== null) {
        payload.value = String(value);
    }
    if (percentage_change !== null) {
        payload.percentage_change = percentage_change;
    }
    if (interval !== null) {
        payload.interval = interval;
    }

    try {
        const response = await axios.post(`${process.env.NAMI_TEST_API_BASE_URL}/api/v3/alert_price`, payload, {
            headers: {
                'fakeauthorization': process.env.NAMI_USER_AUTH_TOKEN
            }
        });

        if (response.data.status === 'ok') {
            let initialMessage = (lang === 'vi') ?
                `Cảnh báo "${base_assets.join(', ')}/${quote_asset} ${translatedAlertType} ${valueDisplay}" đã được cài đặt thành công! Hệ thống sẽ thông báo đến bạn.` :
                `Alert "${base_assets.join(', ')}/${quote_asset} to ${translatedAlertType} ${valueDisplay}" successfully set! You will be notified.`;

            // NEW: Kiểm tra cài đặt thông báo sau khi tạo cảnh báo thành công
            const notificationSetting = await get_nami_notification_setting_internal(lang);
            console.log(notificationSetting)
            if (notificationSetting.success) {
                const deviceNotiStatus = notificationSetting.useDeviceNoti;
                const emailNotiStatus = notificationSetting.emailNoti.includes("@")? true :false;
                
                console.log("emailNotiStatus",deviceNotiStatus)
                let settingMessage = (lang === 'vi') ?
                    `\nCài đặt thông báo hiện tại của bạn là: Thông báo trên thiết bị ${deviceNotiStatus ? 'ĐANG BẬT' : 'ĐANG TẮT'}, Thông báo Email ${emailNotiStatus ? 'ĐANG BẬT' : 'ĐANG TẮT'}.` :
                    `\nYour current notification settings are: Device notifications are ${deviceNotiStatus ? 'ENABLED' : 'DISABLED'}, Email notifications are ${emailNotiStatus ? 'ENABLED' : 'DISABLED'}.`;

                if (!deviceNotiStatus || !emailNotiStatus ) {
                    settingMessage += (lang === 'vi') ?
                        `\nĐể đảm bảo nhận được cảnh báo, bạn có muốn tôi bật cả thông báo trên thiết bị và qua email không?` :
                        `\nTo ensure you receive alerts, would you like me to enable both device and email notifications?`;
                } else {
                    settingMessage += (lang === 'vi') ?
                        `\nBạn có thể quản lý cảnh báo trong Cài đặt Thông báo.` :
                        `\nYou can manage alerts in your Notification Settings.`;
                }
                return {
                    success: true,
                    message: `${initialMessage}${settingMessage}`,
                    ask_to_enable_notifications: (!deviceNotiStatus || !emailNotiStatus) // Cờ để Gemini biết gợi ý bật
                };
            } else {
                console.warn("Không thể kiểm tra cài đặt thông báo sau khi tạo cảnh báo:", notificationSetting.error);
                return {
                    success: true,
                    message: `${initialMessage} ${(lang === 'vi') ? `Bạn có thể quản lý cảnh báo trong Cài đặt Thông báo.` : `You can manage alerts in your Notification Settings.`}`
                };
            }
        } else {
            const errorMessageKey = response.data.error;
            let errorMessage = (lang === 'vi') ? "Đã xảy ra lỗi khi tạo cảnh báo." : "An error occurred while creating the alert.";
            switch(errorMessageKey) {
                case 'INVALID_MAX_ALERT': errorMessage = (lang === 'vi') ? "Bạn đã đạt giới hạn 50 cảnh báo." : "You have reached the maximum of 50 alerts."; break;
                case 'INVALID_MAX_ALERT_PER_PAIR': errorMessage = (lang === 'vi') ? "Bạn đã đạt giới hạn 10 cảnh báo cho cặp này." : "You have reached the maximum of 10 alerts for this pair."; break;
                case 'BODY_MISSING': errorMessage = (lang === 'vi') ? "Thiếu thông tin cần thiết để tạo cảnh báo." : "Missing required information to create alert."; break;
                case 'INVALID_PRICE': errorMessage = (lang === 'vi') ? "Giá trị ngưỡng không hợp lệ." : "Invalid threshold value."; break;
                case 'INVALID_INTERVAL': errorMessage = (lang === 'vi') ? "Khoảng thời gian không hợp lệ. Chỉ chấp nhận các giá trị: 1, 4, 8, 12, 24 giờ." : "Invalid interval. Only accepts: 1, 4, 8, 12, 24 hours."; break;
                default: errorMessage += ` (${errorMessageKey})`;
            }
            return { error: errorMessage };
        }

    } catch (error) {
        console.error(`Lỗi khi gọi API tạo cảnh báo:`, error.response?.data || error.message);
        const apiError = error.response?.data;
        let userFacingError = (lang === 'vi') ? `Không thể tạo cảnh báo lúc này. Vui lòng thử lại sau.` : `Unable to create alert at this time. Please try again later.`;
        if (apiError && apiError.message && typeof apiError.message === 'string') {
            userFacingError = (lang === 'vi') ? `Lỗi: ${apiError.message}` : `Error: ${apiError.message}`;
        }
        return { error: userFacingError };
    }
}


const availableFunctions = {
    create_nami_alert,
    // get_nami_notification_setting không còn là hàm công cụ public
    update_nami_notification_setting // Vẫn là hàm công cụ nếu người dùng muốn bật/tắt
};

module.exports = availableFunctions;