# Schema ও DTO পরিষ্কার

## কী সরানো হয়েছে

- `Lead.legacyPriceText` (`leads.price`): পুরোনো text price; বর্তমান pricing এটি পড়ে না। Migration: `202610290001_drop_unused_lead_price_text`। অপসারণের আগে স্থানীয় ৬টি lead পরীক্ষা করা হয়েছে; এই field সবগুলোতেই খালি ছিল। আলাদা JSON backup রাখা হয়েছে।
- ব্যবহৃত না হওয়া ১০টি DTO file: `UpdateAuthDto`, `CreateCardDto`, `UpdateCardDto`, marketplace-এর অব্যবহৃত query/update DTO, order-এর create/update/checkout DTO, `UpdateSavedSearcDto`, `UpdateWalletDto`। কোনো controller/service এগুলো import করছিল না। Marketplace-এর চালু query parameters অপরিবর্তিত।
- বাদ দেওয়া field লুকানোর জন্য money response helper-এর অপ্রয়োজনীয় filter সরানো হয়েছে।

## কী রাখা হয়েছে এবং কেন

- Lead-এর ঠিকানা, contact, property, category ও source: lead তৈরি, import, search ও preview-এর জন্য।
- `sharedLimit`, `sharedSalesCount`, `exclusiveSoldAt`, `userLead`: lead কেনা হয়েছে বা sold out হয়েছে কি না নির্ধারণের জন্য।
- `classification`, `lastImportedAt`: enrichment/review ও import-এর জন্য; import workflow সম্পূর্ণ হয়নি বলে এগুলো অপ্রয়োজনীয় নয়।
- Order, OrderItem, UserLead: checkout ও কেনা lead-এর স্থায়ী রেকর্ডের জন্য। Checkout API এখনও তৈরি হয়নি; তাই আগের অব্যবহৃত checkout DTO সরানো হয়েছে, প্রয়োজনীয় database models রাখা হয়েছে। নতুন checkout flow তৈরি হলে তার input অনুযায়ী DTO তৈরি করতে হবে।
- Payment ও subscription provider IDs, currency, receipt ও status: payment tracking এবং subscription billing-এর জন্য।
- Wallet-এর `requestId`, `fundingRequestKey`, `operationKey`, `referenceId`, `actorId`: retry-তে একই টাকা দুবার যোগ হওয়া আটকানো এবং transaction-এর উৎস/দায়িত্বশীল admin শনাক্ত করার জন্য। `requestId` DTO field; database-এ funding/operation key রাখা হয়।
- Relation arrays এবং timestamps: Prisma relations, ownership ও history-এর জন্য।

কোনো field nullable হওয়া বা কোনো table এখন খালি থাকার অর্থ সেটি অপ্রয়োজনীয় নয়। পুরোনো migration file পরিবর্তন করা হয়নি।
