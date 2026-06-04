# Micro-Task & Earning Platform (Server Side)

Backend API built with **Node.js, Express, and MongoDB** to power the Micro-Task & Earning Platform.  
Handles authentication, role-based access, task management, payments, and withdrawals.

---

## ✨ Features
1. **Role-based Authentication** (Worker, Buyer, Admin).  
2. **JWT Authorization** for secure API access.  
3. **User Management**: Register, login, update profile, role assignment.  
4. **Task Management**: Create, update, delete, and review tasks.  
5. **Submission Workflow**: Workers submit tasks, Buyers approve/reject, Admin oversees.  
6. **Coin System**:
   - Workers earn coins from approved tasks.  
   - Buyers purchase coins via Stripe.  
   - Admin manages balances and withdrawals.  
7. **Withdrawal System**: Workers request withdrawals (20 coins = $1).  
8. **Stripe Payment Integration** for coin purchases.  
9. **Notification System** for approvals, rejections, and withdrawals.  
10. **Environment Variables** for sensitive credentials.  

---

## 🛠️ Tech Stack
- **Runtime**: Node.js  
- **Framework**: Express.js  
- **Database**: MongoDB (Mongoose ODM)  
- **Authentication**: Firebase Auth
- **Payment**: Stripe Integration  

---