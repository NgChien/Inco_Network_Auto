# Inco Network Auto (Node.js)

Tool tự động mint/shield/check balance nhiều ví trên Base Sepolia, chuyển từ Python sang Node.js.


## Hướng dẫn sử dụng

### 1. Cài đặt Node.js và các package

```bash
cd nodejs
npm install
```

### 2. Chuẩn bị file key.txt
- Đặt file `key.txt` ở thư mục gốc dự án (cùng cấp với thư mục `nodejs`).
- Mỗi dòng là 1 private key (có thể có hoặc không có tiền tố `0x`).

### 3. Cấu hình hành động
- Mở file `nodejs/config.js`, chỉnh sửa biến `ACTION_CONFIG` theo ý muốn:
  - `action`: "mint", "shield", "auto", "check_balance"
  - `amount`: số lượng muốn mint/shield
  - `process_count`: số tiến trình
  - `auto_mode`: "once" hoặc "auto"

### 4. Chạy tool

```bash
npm start
```
hoặc
```bash
node main.js
```

---

Nếu gặp lỗi hoặc cần hỗ trợ, hãy liên hệ tác giả hoặc mở issue trên GitHub! 
