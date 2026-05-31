const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// =========================================================================
// البيانات الخاصة بك للتجربة الحالية
// =========================================================================
const CLIENT_ID = "935417401055-h22umchi7s49c841hju6mmemfhrod8mv.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04kKfGNhamyCoCgYIARAAGAQSNwF-L9Irqy1p44YDlLHTCSqp1n6Gyg4CBr_Stqw_RkjyFYfglwayNrkocAzQjr4BNCl2CjGIyXI";
const CHANNEL_URL = "https://www.youtube.com/@MohamedAbuAlAsateer"; 

// الكوكيز لتجاوز الحجب (احذف السطر المكتوب فيه --cookies-from-browser إذا كنت تشغل الكود على سرفر جيت هاب)
const BROWSER = "chrome"; 

// إعداد مصادقة يوتيوب API
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// 1. جلب العنوان وتحميل أحدث فيديو
function downloadLatestVideo() {
    console.log("جاري استخراج عنوان أحدث فيديو من قناتك...");
    
    let title = "فيديو جديد";
    try {
        // استخراج العنوان
        const titleCmd = `yt-dlp --cookies-from-browser ${BROWSER} --print "%(title)s" --playlist-items 1 "${CHANNEL_URL}"`;
        title = execSync(titleCmd, { encoding: 'utf-8' }).trim();
        console.log(`العنوان الأصلي المكتشف: ${title}`);
        
        console.log("جاري تحميل الفيديو الأساسي...");
        // تحميل الفيديو
        const downloadCmd = `yt-dlp --cookies-from-browser ${BROWSER} -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4" -o "latest_video.mp4" --playlist-items 1 "${CHANNEL_URL}"`;
        execSync(downloadCmd, { stdio: 'inherit' });
        
        return { file: "latest_video.mp4", title: title };
    } catch (error) {
        console.error("حدث خطأ أثناء تحميل الفيديو:", error.message);
        return null;
    }
}

// 2. قص أول 59 ثانية عمودياً (ريلز)
function processVideoToShorts(inputFile) {
    console.log("جاري قص أول دقيقة وتحويلها لأبعاد الريلز العمودية...");
    const outputFile = "test_short.mp4";
    
    try {
        // أمر FFmpeg للقص بجودة سريعة وأبعاد 9:16
        const ffmpegCmd = `ffmpeg -y -ss 0 -i ${inputFile} -t 59 -vf "crop=ih*(9/16):ih,scale=1080:1920" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k ${outputFile}`;
        execSync(ffmpegCmd, { stdio: 'inherit' });
        console.log(`تم تجهيز مقطع الريلز للتجربة: ${outputFile}`);
        return outputFile;
    } catch (error) {
        console.error("حدث خطأ أثناء قص الفيديو:", error.message);
        return null;
    }
}

// 3. الرفع والنشر الفوري (Public)
async function uploadAndPublishImmediately(filePath, originalTitle) {
    console.log("جاري رفع الريلز ونشره علناً فوراً على القناة...");
    
    // ضبط العنوان ليكون متوافقاً مع الهاشتاقات
    const safeTitle = originalTitle.length > 75 
        ? originalTitle.substring(0, 75) + " #shorts #ريلز" 
        : originalTitle + " #shorts #ريلز";

    try {
        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: safeTitle,
                    description: `${originalTitle}\n\n#shorts #ريلز #يوتيوب #تجربة`,
                    tags: ['shorts', 'ريلز', 'يوتيوب'],
                    categoryId: '22'
                },
                status: {
                    privacyStatus: 'public', // تم التعديل إلى public للنشر الفوري بدون جدولة 🚀
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(filePath)
            }
        });
        
        console.log(`\n==================================================`);
        console.log(`🔥 تم النشر الفوري بنجاح! اذهب وتحقق من قناتك الآن.`);
        console.log(`📝 العنوان: ${safeTitle}`);
        console.log(`🆔 سيعمل الرابط قريباً: https://youtu.be/${response.data.id}`);
        console.log(`==================================================`);
    } catch (error) {
        console.error("حدث خطأ أثناء الرفع إلى API يوتيوب:", error.message);
    }
}

// الدالة الرئيسية
async function main() {
    const videoData = downloadLatestVideo();
    
    if (videoData && fs.existsSync(videoData.file)) {
        const shortFile = processVideoToShorts(videoData.file);
        
        if (shortFile && fs.existsSync(shortFile)) {
            await uploadAndPublishImmediately(shortFile, videoData.title);
            
            // تنظيف الملفات
            try {
                fs.unlinkSync(videoData.file);
                fs.unlinkSync(shortFile);
                console.log("تم تنظيف الملفات المؤقتة.");
            } catch (e) {
                console.log("لم يتم حذف الملفات تلقائياً.");
            }
        }
    } else {
        console.log("فشل السكربت في البداية.");
    }
}

main();
