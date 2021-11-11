## Solutions

|Vulnerability| Location|
|--|--|
|Cross-Site Request Forgery| `/comment` |
|Cross-Site Request Forgery| `/upload` |
|Cross-Site Request Forgery| `/background` |
|Cross-Site Scripting Persistent| `/comment` |
|Cross-Site Scripting Reflected| `/get/*` |
|Cross-Site Scripting Reflected| `/post/*` |
|Deserialization| `*` |
|Insecure Direct Object Reference| `/message` |
|Insecure Direct Object Reference| `/delete/comment/*` |
|Missing Function Level Access Controls| `/admin/sql` |
|OS Command Injection| `*` |
|OS Command Injection| `/debug/*` |
|Parameter Based Redirection| `*` |
|SQL Injection| `/login` |