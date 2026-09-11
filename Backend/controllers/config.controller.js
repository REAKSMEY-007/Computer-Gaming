// Exposes the store's bank-transfer payment details to the checkout page.
// Values come from Backend/.env so they can be edited without touching code.
const getBankPaymentInfo = (req, res) => {
  res.json({
    accountName: process.env.BANK_ACCOUNT_NAME || "Your Name Here",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "0000 0000 0000 0000",
    bankName: process.env.BANK_NAME || "ABA Bank",
    khqrImage:
      process.env.KHQR_IMAGE || "/uploads/khqr/khqr.png",
    note: process.env.BANK_PAYMENT_NOTE || "Please make sure to include your order number in the reference.",
  });
};

module.exports = { getBankPaymentInfo };