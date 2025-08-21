# happyEarsBackend

## HAPPY EARS PROJECT
Frontend using React.js, Bootstrap 5
Backend using Node.js
Authentication, Database(including files) using Firebase

### database collections:
1. users - each document representing all information of one user and access authorization
2. invoices - each document representing one invoice with full information and patient id given in form
3. products - each document representing one serial with all basic product information
4. product_logs - log against per product containing current user, reason, operation [operation types: import, invoiced, transfer_add, transfer_remove, returned, add, update ]
5. branches - each document representing one branch with basic information
6. audiometry - each document representing one audiomtry report against a patient with patient id and remarks
7. doctor - each document representing a doctor entity with their respective details and signature file
8. patients - each document representing a patient entity with their name and location
9. salesperson - each document representing a salesperson entity with their name only
10. service - each document representing a patient service request entity with its details including uploaded file