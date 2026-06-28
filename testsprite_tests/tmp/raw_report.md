
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** VERDEXIS
- **Date:** 2026-06-25
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Sign up and enter the dashboard
- **Test Code:** [TC001_Sign_up_and_enter_the_dashboard.py](./TC001_Sign_up_and_enter_the_dashboard.py)
- **Test Error:** TEST FAILURE

Account creation did not complete — the registration request returned a server error and the user was not taken to the dashboard.

Observations:
- The Create Account modal remained visible after submission and displayed the message: 'Request failed with 500'.
- No authenticated dashboard or portfolio content was shown after attempting registration.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/f65fa292-55e4-47e2-ac6c-7dfbfb66db7d
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Withdraw funds from the wallet
- **Test Code:** [TC002_Withdraw_funds_from_the_wallet.py](./TC002_Withdraw_funds_from_the_wallet.py)
- **Test Error:** TEST BLOCKED

The test could not be run to completion because the application returns a server error during login, preventing access to authenticated wallet functionality.

Observations:
- The login modal shows the error message "Request failed with 500" after submitting credentials.
- The user remains unauthenticated, so wallet and withdrawal flows cannot be reached or exercised.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/80cfd93d-5cd2-47ff-baab-f25a72811012
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Place a buy trade and see it reflected
- **Test Code:** [TC003_Place_a_buy_trade_and_see_it_reflected.py](./TC003_Place_a_buy_trade_and_see_it_reflected.py)
- **Test Error:** TEST BLOCKED

The test could not be run because sign-in failed due to a server error, preventing access to trading functionality.

Observations:
- The login modal shows the error message 'Request failed with 500'.
- The user remains on the sign-in modal and is not authenticated, and trading controls are gated behind sign-in.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/ccc7dc45-70e0-42c9-941f-66ecf0c9fbf3
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Place a sell trade and see it reflected
- **Test Code:** [TC004_Place_a_sell_trade_and_see_it_reflected.py](./TC004_Place_a_sell_trade_and_see_it_reflected.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/2b02cba6-0772-4aae-b9e6-39ac205e56af
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Review dashboard holdings and performance
- **Test Code:** [TC005_Review_dashboard_holdings_and_performance.py](./TC005_Review_dashboard_holdings_and_performance.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the UI returned a server error preventing authentication.

Observations:
- The login modal displayed the error message 'Request failed with 500'.
- Authentication could not be completed and the dashboard could not be reached.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/7d620c2f-0c89-4583-816f-7e5424aaa285
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Open the wallet and review balances
- **Test Code:** [TC006_Open_the_wallet_and_review_balances.py](./TC006_Open_the_wallet_and_review_balances.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the UI prevents authentication due to a server error, so the Wallet page could not be reached.

Observations:
- The login modal displays the error message 'Request failed with 500'.
- The login modal remained open and the page did not navigate after clicking 'Sign In'.
- Wallet access could not be verified because authentication failed with a server error.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/f00511ce-a215-4a59-af8b-f16cb813e66f
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Generate a deposit address in the wallet
- **Test Code:** [TC007_Generate_a_deposit_address_in_the_wallet.py](./TC007_Generate_a_deposit_address_in_the_wallet.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the UI returns server errors preventing login, so the wallet page and deposit address flow cannot be reached.

Observations:
- The login modal shows the error message 'Request failed with 500' after submitting valid credentials.
- Authentication did not succeed and the dashboard/wallet page was not reached, blocking the deposit address flow.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/c8537a6f-2885-47d5-9263-3d3f5e226795
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Convert funds in the wallet
- **Test Code:** [TC008_Convert_funds_in_the_wallet.py](./TC008_Convert_funds_in_the_wallet.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the sign-in request returned a server error preventing access to the wallet and the currency conversion flow.

Observations:
- The login modal displayed the error message: 'Request failed with 500'.
- Authentication did not succeed, so the dashboard/wallet pages and conversion features could not be reached.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/be28cd47-fd94-4710-958a-d6ee9aa52d70
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Transfer funds to another user
- **Test Code:** [TC009_Transfer_funds_to_another_user.py](./TC009_Transfer_funds_to_another_user.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/50269f33-214b-4ad4-8696-d8d200e2dcec
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Browse the market list and open an asset detail
- **Test Code:** [TC010_Browse_the_market_list_and_open_an_asset_detail.py](./TC010_Browse_the_market_list_and_open_an_asset_detail.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/2cd3b807-14c5-4952-a46a-1cbe061ca150
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Create a price alert
- **Test Code:** [TC011_Create_a_price_alert.py](./TC011_Create_a_price_alert.py)
- **Test Error:** TEST BLOCKED

The test could not be run — login is failing with a server error, preventing access to the alerts feature.

Observations:
- After submitting credentials the login form displayed the error message 'Request failed with 500'.
- The user remains unauthenticated and the alerts page cannot be reached.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/bb530db4-cf24-4ff4-aef3-0c9d7ffd5615
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 Update profile details successfully
- **Test Code:** [TC012_Update_profile_details_successfully.py](./TC012_Update_profile_details_successfully.py)
- **Test Error:** TEST BLOCKED

The test could not be run because the login flow could not be reached — the /login route returns a 404 Not Found page and no login form is available.

Observations:
- The /login page shows a prominent "404 — Not Found" message and the page content 'Off the chart.'
- No email or password input fields or login/submit button are present on the page (login form absent).
- Navigation options such as 'Back to Home' and 'Open Dashboard' are present, but the explicit /login route required by the test is missing.

Actions performed during this session:
- Navigated to the app root and attempted to open /login.
- Clicked the 'Reload' button on the error page to retry loading /login; the page still shows 404 and no login form.

Conclusion: The prerequisite login UI is not available, so the authenticated user flow (login → navigate to settings → edit profile → save and verify) cannot be executed. The test is blocked until the /login route or an accessible login form is restored in the application.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/193bfd3c-a307-4402-9d2b-f1e6a8bd785d
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Submit KYC information
- **Test Code:** [TC013_Submit_KYC_information.py](./TC013_Submit_KYC_information.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the application's login route is not reachable, preventing access to the KYC flow.

Observations:
- The /login page displays a prominent "404 — Not Found" message and the text "Off the chart.", indicating the route or page is missing.
- The visible actions are navigation links/buttons such as "Back to Home" and "Open Dashboard"; no login form (email/password) or KYC UI elements are present.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/ac03de27-1dcd-4472-bf35-271730149bc6
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 View an asset detail page from a direct asset route
- **Test Code:** [TC014_View_an_asset_detail_page_from_a_direct_asset_route.py](./TC014_View_an_asset_detail_page_from_a_direct_asset_route.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/9bd86e6e-cdd3-43d6-b76f-bbc238b0735e
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Change password successfully
- **Test Code:** [TC015_Change_password_successfully.py](./TC015_Change_password_successfully.py)
- **Test Error:** TEST BLOCKED

The password-change flow could not be executed because sign-in failed with a server error, preventing access to the Settings page required to change the password.

Observations:
- The sign-in attempt returned 'Request failed with 500' and authentication did not complete.
- The homepage is visible with non-authenticated controls (Sign Up / Log In), indicating no user session was established.
- The Settings/password-change page could not be reached because login did not succeed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/17dd2d87-d4a1-4133-8847-9ec1d4d4a3a5/730bcc8b-a896-4985-aaa0-4718f87cb34d
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **26.67** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---