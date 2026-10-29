# Gói cài riêng cho doanh nghiệp nhỏ

Tài liệu làm việc để chào bán, demo và bàn giao bản cài riêng của Invoice Reader.
Các ô `[điền ...]` cần được điền trước khi gửi cho khách. Đây là phạm vi dịch vụ
dự kiến, chưa phải cam kết đã nghiệm thu hoặc bảng giá thị trường.

## 1. Bán một kết quả rõ ràng

**Thông điệp:** “Đọc hóa đơn PDF/ảnh, kiểm tra dữ liệu và xuất Excel/CSV để gửi kế toán,
trên một bản cài riêng cho doanh nghiệp của bạn.”

Khách hàng phù hợp: doanh nghiệp có một người phụ trách tập hợp hóa đơn và đang
nhập lại tên nhà cung cấp, số hóa đơn, ngày, số tiền vào bảng tính.

Gói đầu tiên gồm:

- Một bản triển khai riêng, một dự án database/storage riêng và cấu hình AI riêng.
- Upload PDF/ảnh, AI trích xuất, xem bản gốc, sửa dữ liệu và xác nhận đã duyệt.
- Tìm kiếm, thống kê cơ bản, xuất CSV mở bằng Excel.
- Giao diện tiếng Việt/Anh, buổi hướng dẫn sử dụng và tài liệu bàn giao.
- Chạy nghiệm thu bằng bộ hóa đơn mẫu do khách cung cấp.

Email forwarding là hạng mục tùy chọn, chỉ bàn giao sau khi kiểm tra bằng email thật.
Không đưa vào báo giá cơ bản nếu khách chỉ cần tải file lên.

## 2. Giới hạn cần nói rõ trong demo

- Đây là công cụ hỗ trợ nhập liệu; dữ liệu AI cần được người dùng đối chiếu.
- “Đã duyệt” là người dùng đã xác nhận, không phải xác minh pháp lý hoặc xác nhận đã trả tiền.
- Chưa có nghiệp vụ sổ sách, kê khai thuế, phát hành hóa đơn điện tử hoặc kết nối ngân hàng.
- Mỗi tài khoản hiện quản lý dữ liệu của chính tài khoản đó. Bản cài riêng chưa cung cấp
  kho hóa đơn dùng chung cho nhiều nhân viên, vai trò kế toán/quản lý hoặc duyệt nhiều cấp.
  Gói cơ bản hướng đến một người phụ trách. Không hướng dẫn chia sẻ mật khẩu.
- Tổng tiền giữ riêng theo từng loại tiền tệ; không tự quy đổi tỷ giá.
- Xuất CSV tối đa 5.000 hóa đơn mỗi lần; chọn khoảng thời gian hẹp hơn khi cần.
- Có chống gửi lại file trùng và giới hạn tần suất khi cấu hình Redis; chưa có hạn mức
  sử dụng/tháng hoặc chặn chi phí AI theo gói. Email intake chưa có rate limit.
- File vẫn được gửi đến nhà cung cấp AI để xử lý. Bản cài riêng không có nghĩa là
  AI chạy offline hay không có bên thứ ba.

Nếu khách cần dữ liệu dùng chung hoặc tích hợp phần mềm kế toán, tách thành phạm vi
báo giá riêng sau khi xác nhận yêu cầu.

## 3. Mẫu báo giá ngắn

**Khách hàng:** [điền tên doanh nghiệp]

**Kết quả bàn giao:** một ứng dụng tại [điền tên miền], giúp [điền người phụ trách]
tải hóa đơn lên, kiểm tra dữ liệu và xuất CSV cho kế toán.

| Hạng mục | Phạm vi | Phí |
| --- | --- | --- |
| Cài đặt một lần | Triển khai, cấu hình, nghiệm thu, hướng dẫn | [điền giá] VND |
| Bảo trì tùy chọn | [điền số giờ], cập nhật và hỗ trợ qua [điền kênh] | [điền giá] VND/tháng |
| Dịch vụ bên thứ ba | Hosting, database/storage, AI; email nếu chọn | Khách thanh toán trực tiếp theo sử dụng |
| Yêu cầu ngoài phạm vi | Tính năng mới, tích hợp, nhập dữ liệu lịch sử | Báo giá riêng |

- Thời gian thực hiện: [điền] ngày làm việc kể từ khi có đủ tài khoản và hóa đơn mẫu.
- Thanh toán: [điền khoản bắt đầu], phần còn lại sau nghiệm thu theo checklist.
- Bảo hành lỗi đúng phạm vi: [điền thời hạn]; thời gian phản hồi hỗ trợ: [điền].
- Quyền sử dụng mã nguồn, quyền chỉnh sửa, quyền bán lại và hình thức bàn giao:
  [điền thỏa thuận; kiểm tra quyền đối với mã nguồn và các thành phần sử dụng].
- Không gộp chi phí AI không giới hạn vào phí cài đặt.

## 4. Câu hỏi lấy yêu cầu trước khi nhận cài

1. Mỗi tháng có khoảng bao nhiêu hóa đơn? PDF có chữ, bản scan hay ảnh chụp?
2. Ai là người phụ trách? Cần một người dùng hay nhiều người dùng chung dữ liệu?
3. Xin 10–20 hóa đơn mẫu đã được phép dùng; có loại tiền tệ hoặc mẫu nào đặc biệt?
4. Bảng CSV hiện cần những cột nào? Xin file mẫu đầu ra kế toán đang dùng.
5. Chỉ upload hay cần nhận hóa đơn qua email?
6. Tài khoản dịch vụ và tên miền do ai sở hữu? Có yêu cầu lưu trữ hoặc xử lý dữ liệu nào?
7. Ai nhận bàn giao, ai trả phí dịch vụ, ai phụ trách sao lưu và hỗ trợ sau bàn giao?

Chỉ chốt báo giá sau khi chạy thử các mẫu đại diện. Ghi nhận lỗi đọc được sửa thủ công,
không hứa AI chính xác 100% hoặc dùng được với mọi loại tài liệu.

## 5. Demo khoảng 10 phút

1. Mở tài khoản mới và làm theo hướng dẫn 3 bước trên Tổng quan.
2. Upload một PDF và một ảnh của khách; mở Hộp thư để đối chiếu bản gốc.
3. Sửa một giá trị, lưu, sau đó đánh dấu đã duyệt.
4. Chọn Trích xuất lại: dữ liệu đã lưu vẫn giữ nguyên; xem đề xuất rồi nhấn Hủy.
5. Lọc hóa đơn và tải CSV, mở trong Excel để kiểm tra dấu tiếng Việt và số tiền.
6. Chốt rõ phạm vi gói, dịch vụ bên thứ ba và các điểm chưa đáp ứng.

## 6. Cài đặt cho từng khách

Hướng dẫn lệnh và biến môi trường ở [CUSTOMER-SETUP.md](CUSTOMER-SETUP.md),
quy trình triển khai ở [deploy.md](deploy.md). Với mỗi khách:

- Dùng tài khoản/tổ chức do khách sở hữu; khách mời bạn vào với quyền cần thiết.
- Tạo dự án hosting và Supabase riêng; dùng key riêng cho AI và Redis.
- Không trỏ bản cài mới vào database, storage hoặc inbox của khách khác.
- Bản cơ bản để trống AgentMail/Trigger; chọn provider hỗ trợ PDF/ảnh.
- Cấu hình tên miền, URL xác thực, email xác nhận/khôi phục mật khẩu và Redis.
- Áp dụng migration, chạy quality gates và checklist nghiệm thu bên dưới.
- Nếu thêm email: cấu hình dự án Trigger, webhook và inbox riêng, gửi email thật
  để kiểm tra cả nhận file, trích xuất, chống trùng và phản hồi.
- Kiểm tra ai có thể đăng ký vào bản cài và thiết lập chính sách phù hợp trước khi công khai.
- Ghi ngân sách, đầu mối nhận cảnh báo chi phí và cách dừng xử lý khi vượt ngân sách.
- Chỉ ghi tên biến, nơi lưu và người sở hữu vào biên bản; không ghi secret.

## 7. Checklist nghiệm thu trên bản đã triển khai

Tạo bản sao [mẫu biên bản](PRIVATE-INSTALL-ACCEPTANCE-VI.md) cho từng khách.
Không đánh dấu hoàn tất chỉ vì build hoặc unit test đã chạy thành công.

- [ ] Đăng ký/đăng nhập và khôi phục mật khẩu qua email thật.
- [ ] 10–20 hóa đơn đại diện: PDF, ảnh, có/không có thuế, tiền tệ khách dùng.
- [ ] Các trường bắt buộc trong mẫu đầu ra được đọc hoặc sửa thủ công được.
- [ ] Upload trùng không tạo bản ghi mới; file sai định dạng có thông báo rõ.
- [ ] AI đọc xong chưa được hiển thị là người dùng đã duyệt.
- [ ] Sửa và lưu làm hóa đơn cần duyệt lại; duyệt xong bộ lọc Đã duyệt tìm thấy đúng.
- [ ] Trích xuất lại → Hủy giữ nguyên; Trích xuất lại → Lưu chỉ đổi sau thao tác lưu.
- [ ] Chi tiết dòng và đơn giá của bản đề xuất có thể kiểm tra trước khi lưu.
- [ ] Xuất CSV đúng bộ lọc và đối chiếu số dòng/số tiền với dữ liệu đã duyệt.
- [ ] Dùng tài khoản thứ hai để thử: không xem/sửa/tải file của tài khoản thứ nhất.
- [ ] Giao diện EN/VI dùng được trên máy và điện thoại của người nhận bàn giao.
- [ ] Thiết lập sao lưu database và file, thời gian lưu, người phụ trách; thử phục hồi
      vào môi trường riêng. CSV không phải bản sao lưu đầy đủ.
- [ ] Nếu có email: email thật chạy qua toàn bộ chuỗi; lỗi có thể tìm được trong logs.

## 8. Tìm khách đầu tiên

Gửi thủ công cho một số doanh nghiệp bạn có thể hỗ trợ trực tiếp:

> Bên mình có công cụ đọc hóa đơn PDF/ảnh và xuất bảng gửi kế toán, cài riêng cho
> doanh nghiệp. Nếu bên bạn đang nhập hóa đơn vào Excel thủ công, mình có thể demo
> bằng vài mẫu đã ẩn thông tin nhạy cảm của bên bạn. Mình sẽ báo rõ phần đọc được,
> phần cần sửa và chi phí cài đặt trước khi triển khai.

Không cần quảng cáo rộng ngay. Lấy một ca nghiệm thu có trả phí, ghi thời gian trước/sau
và những thao tác khách còn mắc, rồi dùng thông tin đó để cải thiện gói tiếp theo.
