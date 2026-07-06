# **QA Review Report – NeuroGauge Africa**

**Tester:** QA Engineer  
 **Environment:** Production (`https://www.neurogauge.africa`)  
 **Scope:** Public-facing pages (Homepage, Sign-up, Login, Results)  
 **Test Type:** Static Analysis / UI & SEO Review

---

## **Summary**

I ran the homepage, sign-up, login, and results pages through a static analysis. One important caveat upfront: I was only able to inspect the publicly accessible markup, content, links, and metadata. I was **not able to execute the JavaScript application**, meaning the actual N-back assessment, user dashboard, authentication flow, CSV export, and account creation process were **not functionally tested**.

This should be considered the highest priority for the next QA phase. I strongly recommend carrying out a complete end-to-end functional test using Playwright or Cypress against the live application.

Overall, the public-facing product presents well. The information architecture is clear, the content demonstrates domain knowledge in cognitive science, and the platform communicates its research focus effectively. However, there are several issues that should be addressed before broader adoption, particularly by academic researchers and institutions that expect a high level of technical polish, compliance, and reliability.

---

# **Initial Recommendations**

Before discussing individual findings, I recommend prioritizing the following:

### **1\. Conduct Full End-to-End QA Testing**

The current assessment covers only the static portions of the application.

The following components still require comprehensive testing:

* User registration  
* Login  
* Password reset  
* Dashboard  
* N-back assessment engine  
* Result computation  
* Result persistence  
* CSV/SPSS export  
* Research project management  
* Multi-user permissions  
* Mobile responsiveness  
* Browser compatibility

This should ideally be automated using Playwright or Cypress.

---

### **2\. Improve SEO Before Indexing**

Although the website has good technical foundations, several SEO issues reduce its ability to rank effectively.

Immediate priorities include:

* Unique page titles  
* Unique meta descriptions  
* Open Graph metadata  
* Twitter cards  
* Structured data  
* Better crawlability for JavaScript-rendered pages

---

### **3\. Strengthen Privacy & Compliance Documentation**

Since NeuroGauge collects:

* participant emails,  
* behavioural data,  
* reaction time measurements,  
* cognitive assessment results,

the platform should visibly provide:

* Privacy Policy  
* Terms of Service  
* Cookie Policy (if applicable)  
* Participant Consent information  
* Data Retention Policy

These are particularly important for researchers seeking institutional ethics (IRB) approval.

---

# **What's Working Well**

## **1\. Clear Information Architecture**

Navigation is consistent across the pages reviewed.

Primary navigation includes:

* Home  
* My Results  
* Sign In  
* For Researchers

Primary CTAs route correctly:

* "Start for Free" → Sign-up  
* "Check My Results" → Results page

The navigation feels intuitive and easy to follow.

---

## **2\. Proper Domain Canonicalization**

The bare domain correctly redirects to:

`https://www.neurogauge.africa`

This avoids duplicate indexing and is good for SEO.

---

## **3\. HTTPS Enforcement**

HTTPS is correctly enforced across the site.

This is expected for a platform handling participant data and is correctly implemented.

---

## **4\. Scientifically Credible Content**

The methodology descriptions reference:

* N-back task levels  
* NASA-TLX  
* d-prime  
* Criterion  
* Reaction time capture using `performance.now()`

The terminology is accurate and conveys genuine understanding of cognitive assessment rather than generic marketing content.

This builds credibility with the intended research audience.

---

## **5\. Research Disclaimer**

The "For research use only" disclaimer is present.

This is appropriate given the intended use case and helps set correct expectations.

---

# **Issues Identified**

---

## **1\. Duplicate SEO Metadata**

**Severity:** Medium

### **Observation**

The following pages all use exactly the same:

* `<title>`  
* Meta description

Instead of describing their individual purpose, they all inherit the homepage metadata.

Example:

"Measure working memory with research-grade precision..."

This affects:

* Homepage  
* Sign-up  
* Login  
* Results

### **Impact**

* Reduced SEO effectiveness  
* Lower search relevance  
* Poor browser tab identification  
* Reduced accessibility

### **Recommendation**

Provide unique metadata for every page.

Examples:

**Homepage**

NeuroGauge Africa | Research-Grade Working Memory Assessment

**Login**

Sign In | NeuroGauge Africa

**Signup**

Create Your NeuroGauge Account

**Results**

View Assessment Results | NeuroGauge Africa

---

## **2\. Title Tag Formatting Bug**

**Severity:** Low

### **Observation**

The title tag contains a double space:

Neurogauge  Neuroscience Lab

This appears consistently across all reviewed pages, suggesting it originates from the shared layout template.

### **Recommendation**

Remove the duplicate spacing within the title template.

---

## **3\. Possible Client-Side Rendering / No-JavaScript Issue**

**Severity:** Medium (Requires Confirmation)

### **Observation**

Static extraction of:

* Sign-up  
* Login  
* Results

returned only headings such as:

* Welcome Back  
* Create an Account

The actual form fields were absent.

This may indicate that the pages rely entirely on client-side JavaScript to render their content.

### **Potential Risks**

If confirmed:

* Reduced SEO crawlability  
* Accessibility issues  
* Blank experience when JavaScript fails  
* Poor performance on search engine indexing

### **Recommendation**

Verify by testing:

* View Source  
* JavaScript disabled  
* Lighthouse  
* Google Rich Results Test

Consider server-side rendering (SSR) or prerendering critical pages if necessary.

---

## **4\. Duplicate Logo Link**

**Severity:** Low

### **Observation**

On the Sign-up, Login, and Results pages, the logo link appears twice consecutively within the header markup.

This appears to be a layout component issue rather than duplicated content.

### **Recommendation**

Review the shared header component and remove the duplicated logo element.

---

## **5\. Missing Privacy & Legal Documentation**

**Severity:** High

### **Observation**

No visible links were found for:

* Privacy Policy  
* Terms of Service  
* Consent Information

This is concerning because the application stores identifiable participant information and cognitive assessment data.

### **Impact**

Researchers seeking institutional ethics approval (IRB) will typically require these documents before adopting the platform.

Their absence could become a significant barrier to institutional use.

### **Recommendation**

Add clearly visible links (preferably in the footer) to:

* Privacy Policy  
* Terms of Service  
* Data Processing Notice  
* Participant Consent Guidance  
* Contact Information

---

# **Areas Requiring Functional Verification**

The following could not be confirmed during static analysis but should be tested thoroughly.

---

## **1\. Results Lookup Security**

The results page indicates that users can retrieve assessment sessions using their email address.

If this process simply returns results for any entered email address, it introduces a significant data enumeration risk.

### **Verify**

* Email verification  
* OTP authentication  
* Magic link authentication  
* Session validation

must occur before results are displayed.

---

## **2\. Unauthenticated Assessment Links**

Allowing participants to take assessments without logging in improves usability.

However, testing should verify:

* Duplicate submissions  
* Replay attacks  
* Bot protection  
* Session integrity  
* Rate limiting

---

## **3\. Assessment Engine Accuracy**

The following require functional validation:

* Timing precision  
* N-back scoring accuracy  
* Reaction time calculations  
* NASA-TLX scoring  
* d-prime calculations  
* Criterion calculations

---

## **4\. Data Export**

Verify that exported CSV/SPSS datasets:

* Match displayed results  
* Preserve precision  
* Include all expected variables  
* Use correct column naming

---

## **5\. Multi-Researcher Permissions**

Confirm that:

* Researchers cannot access projects belonging to other researchers.  
* Project-level permissions are enforced.  
* Shared datasets respect role-based access controls.

---

# **Overall Assessment**

The marketing and informational layer of NeuroGauge Africa is well structured and communicates its research focus effectively. The platform demonstrates a solid understanding of cognitive assessment concepts and provides a good first impression for its target audience.

That said, several improvements are needed to reach the level of polish expected by academic institutions and research organizations. Addressing the SEO metadata issues, resolving the template-level UI inconsistencies, and publishing comprehensive privacy and legal documentation should be prioritized before wider deployment.

The most critical concern requiring immediate verification is the results retrieval mechanism. If participant data can be accessed solely by entering an email address without an additional verification step, this presents a significant privacy and security risk that should be resolved before handling real participant data.

Finally, while the public-facing interface appears promising, the core application—including the assessment engine, authentication workflows, dashboard functionality, data exports, and access controls—still requires a comprehensive end-to-end functional QA pass before the platform can be considered production-ready for research use.

