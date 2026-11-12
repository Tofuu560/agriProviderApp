"""Rebuild documentation artifacts. Requires reportlab; no database access."""
import json, pathlib, re, html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4

ROOT=pathlib.Path(__file__).resolve().parents[1]
DOC=ROOT/'docs'; OUT=ROOT/'output/pdf'; POST=DOC/'postman'
OUT.mkdir(parents=True,exist_ok=True);POST.mkdir(parents=True,exist_ok=True)
routes=json.loads((DOC/'api/route-inventory.json').read_text())
api=DOC/'api-documentation.md'
base=api.read_text(encoding='utf8').split('<!-- ROUTE_INVENTORY -->')[0]
table=['<!-- ROUTE_INVENTORY -->','', '| Method | Path | Access | Handler |','|---|---|---|---|']
for r in routes:
    parts=r['path'].split('/')
    access='Public' if len(parts)<4 or parts[3]=='auth' else parts[3]
    if r['path'].startswith('/files/'):access='Signed link'
    if access=='integrations':access='Scoped API key'
    if access=='me':access='Any authenticated user'
    table.append(f"| {r['method']} | `{r['path']}` | {access} | [{pathlib.Path(r['source']).name}](../{r['source']}) |")
api.write_text(base+'\n'.join(table)+'\n',encoding='utf8')

# Evidence-based tracker, with owners expressed as responsibilities, not invented assignments.
items=[
 ('AP-01','Five role portals','Implemented','Development','Role routes and permissions; historical API/browser checks','Maintain role isolation on changes'),
 ('AP-02','Staff approval and MFA','Implemented','Development / Admin','Pending applications, setup QR and recovery flows tested','Configure real account delivery'),
 ('AP-03','Provider programme and cohort management','Implemented','Provider / Development','Provider creation/closure; admin read-only','User acceptance on final training data'),
 ('AP-04','Learner accounts and documents','Implemented','Development','Private ID/consent uploads; two-recipient account emails','Validate actual document templates'),
 ('AP-05','Attendance and offline queue','Locally validated','Development / QA','Idempotent sync and browser offline journeys','Physical phone and background tests'),
 ('AP-06','Individual evidence and review','Implemented','Assessor / QA','Separate reports/packs, history and correction flow','Business sign-off with real sample packs'),
 ('AP-07','Certification and milestones','Implemented','QA','Conditions, independent moderation, status-only unlock','No public QR verification or real payments'),
 ('AP-08','South African localisation','Implemented','Development','SAST, calendar controls, province/country/phone checks','Confirm on target device locales'),
 ('AP-09','Neon Frankfurt database','Verified','Operations','30 application tables matched; 11 accounts/4 learners/0 evidence at cutover','Maintain protected backups and branch isolation'),
 ('AP-10','Local services and exports','Verified','Development','Readiness/web 200; web and native bundle exports recorded','Exports are not signed installs'),
 ('AP-11','Documentation pack','Prepared','Development','System/API guide, route inventory, Postman and tracker','Keep contracts and verification record current'),
 ('AP-12','Public API/web deployment','Pending','Operations','Local processes only; Render production not configured','Provision hosting, domains, TLS and secrets'),
 ('AP-13','Real email and private files','Pending','Operations','Current mail/files use local development adapters','Configure SMTP and private S3-compatible storage'),
 ('AP-14','Production malware scanning','Pending','Operations / Security','Development checks available; production requires scanner','Configure scanner and validate fail-closed behavior'),
 ('AP-15','Signed Android/iOS releases','Pending','Mobile release owner','Hermes bundle exports passed','Configure EAS signing and distribution'),
 ('AP-16','Physical phone acceptance','Pending','QA / Product owner','Browser phone viewport tests only','Test Android/iPhone camera, sync, permissions and push'),
 ('AP-17','External integration delivery','Pending','Integration owner','Scoped endpoints and durable outbox implemented','Verify Passport receiver and push delivery end to end'),
 ('AP-18','Recovery and release approval','Pending','Operations / Product owner','Local backup preserved and migration checked','Rehearse production restore; approve release criteria')
]
tracker={'date':'2026-11-12','timezone':'Africa/Johannesburg','baseline':'e1144af','branch':'my-new-app','items':[dict(zip(['id','workstream','status','owner','evidence','next'],i)) for i in items]}
(DOC/'project-tracker.json').write_text(json.dumps(tracker,indent=2)+'\n')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleGreen',fontName='Helvetica-Bold',fontSize=25,leading=29,textColor=colors.HexColor('#164c38'),spaceAfter=16))
styles.add(ParagraphStyle(name='CellSmall',fontName='Helvetica',fontSize=8.4,leading=11,spaceAfter=0))
styles['BodyText'].fontSize=10;styles['BodyText'].leading=14
story=[]
def p(s,style='BodyText'):return Paragraph(html.escape(s),styles[style])
def add(s,style='BodyText'):story.append(p(s,style));story.append(Spacer(1,9))
def heading(s):add(s,'Heading2')
def grid(rows,widths):
    data=[[p(str(c),'CellSmall') for c in row] for row in rows]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e0eee6')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),1,colors.HexColor('#164c38')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#ccd8d0'))]))
    story.append(t)
add('AgriProvider\nProject tracker','TitleGreen')
add('Delivery and acceptance snapshot | 12 November 2026 | SAST')
add('Branch: my-new-app  /  Application baseline: e1144af')
heading('Current position')
add('Core workflows are implemented and locally validated. The working database is on Neon in Frankfurt. Public production hosting, external services, signed mobile builds and physical-device acceptance remain outstanding.')
grid([['Snapshot','Evidence'],['11 accounts / 4 learners','Filtered development copy; not a product limit'],['0 active evidence files','Uploads excluded at user request; original local files and database backed up'],['30 application tables','Migration contents verified; encryption/MFA data readable'],['53 API / 30 browser cases','Historical successful results across full runs and targeted reruns; not rerun for this PDF'],['Web + native bundle exports','Build artifacts validated historically; no signed physical-device acceptance']], [155,352])
heading('Status definitions')
add('Implemented: feature exists with recorded tests. Locally validated: limited to local/browser conditions. Verified: the named operational check was performed. Prepared: artifact created, with its execution status recorded separately. Pending: acceptance or external setup still required.')
heading('Release boundary')
add('Do not label this project production-ready until AP-12 through AP-18 are accepted. No promised delivery dates are assigned: external accounts, infrastructure and release-owner availability determine the schedule.')
story.append(PageBreak())
add('Implementation tracker','TitleGreen')
add('Owners below are responsibility roles, not named staff assignments.')
grid([['ID / workstream','Status / owner','Evidence and next step']]+[[f'{x[0]}\n{x[1]}',f'{x[2]}\n{x[3]}',f'{x[4]}. Next: {x[5]}.'] for x in items[:8]], [139,112,256])
story.append(PageBreak())
add('Deployment and acceptance','TitleGreen')
grid([['ID / workstream','Status / owner','Evidence and next step']]+[[f'{x[0]}\n{x[1]}',f'{x[2]}\n{x[3]}',f'{x[4]}. Next: {x[5]}.'] for x in items[8:]], [139,112,256])
story.append(PageBreak())
add('Release gates and handover','TitleGreen')
grid([['Gate','Acceptance evidence'],['Infrastructure','Public web/API healthy over TLS; correct origins; production database branch isolated from tests'],['Storage and mail','Private upload/download, scanner rejection and fail-closed checks; setup and creator emails received'],['Quality journey','Provider enrolment -> attendance -> assessor -> independent moderation -> QA -> certificate release, plus rejection/re-upload'],['Mobile','Signed Android/iOS installs; real device offline recovery, permissions, camera and push acceptance'],['Recovery','Restore database and file backup with matching secrets; verify authentication, records, file access and audit continuity'],['Owner sign-off','Product, QA and operations approve documented limitations and support process']], [120,387])
heading('Risks and dependencies')
add('Removing learners can leave enrolment below cohort capacity and block verification. Existing grades and learning records remain, while evidence approvals were reset. Newly uploaded development files still live on this computer. Seed/demo credentials must never be used for public production. Real delivery services and native signing need configured external accounts.')
heading('Evidence sources')
add('Repository: docs/testing.md, docs/deployment.md, docs/system-documentation.md, docs/api-documentation.md and docs/postman/validation-results.md. Source tracker: docs/project-tracker.json. Private migration report/backups are ignored under .data and are not included in the handover pack.')
def footer(canvas,doc):
    canvas.setStrokeColor(colors.HexColor('#ccd8d0'));canvas.line(44,39,551,39)
    canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#52665b'))
    canvas.drawString(44,26,'AgriProvider | Development delivery snapshot | 12 Nov 2026')
    canvas.drawRightString(551,26,f'Page {doc.page}')
SimpleDocTemplate(str(OUT/'agriprovider-project-tracker.pdf'),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=42,bottomMargin=52,title='AgriProvider Project Tracker',author='AgriProvider').build(story,onFirstPage=footer,onLaterPages=footer)

# Postman collection: safe smoke and explicit opt-in disposable workflows.
folders={x:[] for x in ['01 Read-only smoke','02 Authenticated reads','03 Disposable workflow tests']}
cases=[]
def req(cid,name,method,path,status=200,body=None,auth=None,folder='01 Read-only smoke',code=None,checks=None,pre='',needs='',description=''):
    tests=[f"pm.test('HTTP {status}', () => pm.expect(pm.response.code).to.eql({status}));"]
    if code:tests.append(f"pm.test('Error code', () => pm.expect(pm.response.json().code).to.eql('{code}'));")
    tests+=checks or []
    request={'method':method,'header':[],'url':'{{baseUrl}}'+path,'description':description,'auth':{'type':'noauth'}}
    if auth:request['auth']={'type':'bearer','bearer':[{'key':'token','value':'{{'+auth+'}}','type':'string'}]}
    if body is not None:
        request['header']=[{'key':'Content-Type','value':'application/json'}]
        request['body']={'mode':'raw','raw':json.dumps(body,indent=2),'options':{'raw':{'language':'json'}}}
    guard=''
    if folder!='01 Read-only smoke':
        guard="if(pm.environment.get('allowTestExecution')!=='true' || pm.variables.replaceIn('{{baseUrl}}')!=='http://localhost:4001'){console.warn('Skipped: enable disposable test execution at port 4001.');pm.execution.skipRequest();}\n"
    if needs:
        for n in needs.split(','):guard+=f"if(!pm.environment.get('{n}')){{console.warn('Skipped: set {n} using disposable fixtures.');pm.execution.skipRequest();}}\n"
    events=[{'listen':'test','script':{'type':'text/javascript','exec':tests}}]
    if guard+pre:events.insert(0,{'listen':'prerequest','script':{'type':'text/javascript','exec':(guard+pre).splitlines()}})
    item={'name':cid+' '+name,'request':request,'event':events,'response':[]}
    folders[folder].append(item);cases.append((cid,name,folder,status,code or 'See assertions',description))
    return item
shape=["pm.test('Error envelope', () => { const b=pm.response.json(); pm.expect(b.message).to.be.a('string'); pm.expect(b.fields).to.be.an('array'); });"]
req('SM-01','API liveness','GET','/healthz',checks=["pm.test('Healthy',()=>pm.expect(pm.response.json().status).to.eql('ok'));"])
req('SM-02','Database readiness','GET','/readyz',checks=["pm.test('Ready',()=>pm.expect(pm.response.json().status).to.eql('ready'));"])
req('SM-03','Missing session rejected','GET','/api/v1/me',401,code='UNAUTHENTICATED',checks=shape)
req('SM-04','Missing integration key rejected','GET','/api/v1/integrations/programmes',403,code='INVALID_KEY',checks=shape)
req('SM-05','Unknown endpoint','GET','/not-an-endpoint',404,code='NOT_FOUND',checks=shape)
req('SM-06','Provider namespace needs login','GET','/api/v1/provider/cohorts',401,code='UNAUTHENTICATED',checks=shape)
F='02 Authenticated reads'
req('AU-01','Login disposable user','POST','/api/v1/auth/login',body={'email':'{{email}}','password':'{{password}}','transport':'native'},folder=F,needs='email,password',checks=["pm.test('Session returned',()=>pm.expect(pm.response.json().accessToken).to.be.a('string'));","const b=pm.response.json(); if(b.accessToken){pm.environment.set('accessToken',b.accessToken);pm.environment.set('refreshToken',b.refreshToken);}"],description='Use an approved disposable provider without MFA. For MFA users add code; a setup challenge is not a successful session.')
req('AU-02','Current account','GET','/api/v1/me',auth='accessToken',folder=F,needs='accessToken',checks=["pm.test('User present',()=>pm.expect(pm.response.json().user.id).to.be.a('string'));"])
for cid,role in [('AU-03','provider'),('AU-04','assessor')]:
    req(cid,role+' cohorts','GET',f'/api/v1/{role}/cohorts',auth=role+'Token',folder=F,needs=role+'Token',checks=["pm.test('List',()=>pm.expect(pm.response.json()).to.be.an('array'));"])
req('AU-05','Private learner courses','GET','/api/v1/learner/courses',auth='learnerToken',folder=F,needs='learnerToken',checks=["pm.test('Own course projection',()=>{const rows=pm.response.json();pm.expect(rows).to.be.an('array');rows.forEach(x=>{pm.expect(x).not.to.have.property('enrolments');pm.expect(x).not.to.have.property('evidence');});});"])
req('AU-06','Provider cannot administer','GET','/api/v1/admin/users',403,auth='providerToken',folder=F,needs='providerToken',code='FORBIDDEN')
req('AU-07','QA audit queue','GET','/api/v1/qa/audits',auth='qaToken',folder=F,needs='qaToken',checks=["pm.test('List',()=>pm.expect(pm.response.json()).to.be.an('array'));"])
req('AU-08','Administrator overview','GET','/api/v1/admin/dashboard',auth='adminToken',folder=F,needs='adminToken',checks=["pm.test('Pending count',()=>pm.expect(pm.response.json().pendingAccounts).to.be.a('number'));"])
F='03 Disposable workflow tests'
req('WF-01','Reject admin self-signup','POST','/api/v1/auth/signup',400,body={'fullName':'Test Person','email':'test-admin@example.invalid','password':'Temporary!Pass8923','role':'ADMIN','organisation':'Test Centre'},folder=F,code='VALIDATION_ERROR')
req('WF-02','Reject invalid learner identity','POST','/api/v1/provider/learners',400,body={'cohortId':'{{cohortId}}','fullName':'Test Learner','nationalId':'123','phone':'+27821234567','consent':True,'clientOpId':'{{$guid}}'},auth='providerToken',folder=F,needs='providerToken,cohortId',code='VALIDATION_ERROR')
req('WF-03','Create lesson material','POST','/api/v1/provider/cohorts/{{cohortId}}/materials',body={'title':'Postman lesson','content':'Disposable lesson material for API validation.','url':'https://example.org/lesson'},auth='providerToken',folder=F,needs='providerToken,cohortId',checks=["pm.test('Created ID',()=>pm.expect(pm.response.json().id).to.be.a('string'));"])
req('WF-04','Reject unsafe material URL','POST','/api/v1/provider/cohorts/{{cohortId}}/materials',400,body={'title':'Test lesson','content':'Disposable validation content.','url':'http://example.org/lesson'},auth='providerToken',folder=F,needs='providerToken,cohortId',code='VALIDATION_ERROR')
req('WF-05','QA rejects blank correction','POST','/api/v1/qa/milestones/{{milestoneId}}/reject',400,body={'reason':' '},auth='qaToken',folder=F,needs='qaToken,milestoneId',code='VALIDATION_ERROR')
req('WF-06','QA requests correction','POST','/api/v1/qa/milestones/{{milestoneId}}/reject',body={'reason':'Please re-upload the learner ID.','evidenceIds':[]},auth='qaToken',folder=F,needs='qaToken,milestoneId',checks=["pm.test('Correction saved',()=>pm.expect(pm.response.json().ok).to.eql(true));"],description='Mutates all evidence review states for the selected milestone. Prepare a disposable unlocked milestone to prove rejection works after unlock.')
req('WF-07','Verify correction persisted','GET','/api/v1/qa/cohorts/{{cohortId}}',auth='qaToken',folder=F,needs='qaToken,cohortId,milestoneId',checks=["pm.test('Milestone reopened',()=>{const m=pm.response.json().milestones.find(x=>x.id===pm.environment.get('milestoneId'));pm.expect(m.state).to.eql('REJECTED');pm.expect(m.unlockedAt).to.eql(null);});"])
req('WF-08','Upload learner ID','POST','/api/v1/learner/cohorts/{{cohortId}}/learner-packs/{{learnerId}}/files',auth='learnerToken',folder=F,needs='learnerToken,cohortId,learnerId',pre="pm.environment.set('uploadOpId',pm.variables.replaceIn('{{$guid}}'));",checks=["pm.test('File created',()=>pm.expect(pm.response.json().id).to.be.a('string'));","pm.environment.set('evidenceId',pm.response.json().id);"],description='Choose a genuine PDF/JPG/PNG fixture in the file field. Cohort must be editable and learner enrolled. Metadata precedes file.')
upload=folders[F][-1];upload['request']['body']={'mode':'formdata','formdata':[{'key':'metadata','type':'text','value':'{"type":"ID_DOCUMENTS","clientOpId":"{{uploadOpId}}","signed":false}'},{'key':'file','type':'file','src':[]}]}
req('WF-09','Replay same upload once','POST','/api/v1/learner/cohorts/{{cohortId}}/learner-packs/{{learnerId}}/files',auth='learnerToken',folder=F,needs='learnerToken,cohortId,learnerId,uploadOpId,evidenceId',checks=["pm.test('Same evidence ID',()=>pm.expect(pm.response.json().id).to.eql(pm.environment.get('evidenceId')));"],description='Choose the exact same file bytes as WF-08. Keep uploadOpId unchanged. A new operation ID tests history instead of replay.')
folders[F][-1]['request']['body']=json.loads(json.dumps(upload['request']['body']))
req('WF-10','Other learner cannot download','GET','/api/v1/learner/evidence/{{evidenceId}}/download',404,auth='otherLearnerToken',folder=F,needs='otherLearnerToken,evidenceId',code='NOT_FOUND',description='otherLearnerToken must belong to a different learner from the uploader.')
req('WF-11','Provider submits individual pack','POST','/api/v1/provider/cohorts/{{cohortId}}/learner-packs/{{learnerId}}/submit',body={'action':'SUBMIT'},auth='providerToken',folder=F,needs='providerToken,cohortId,learnerId',checks=["pm.test('Assessor handoff',()=>pm.expect(pm.response.json().status).to.eql('ASSESSOR_REVIEW'));"],description='Before running, provide all four initial documents for this learner; WF-08 alone is insufficient.')
req('WF-12','Assessor forwards complete pack','POST','/api/v1/assessor/cohorts/{{cohortId}}/learner-packs/{{learnerId}}/submit',body={'action':'APPROVE'},auth='assessorToken',folder=F,needs='assessorToken,cohortId,learnerId',checks=["pm.test('QA handoff',()=>pm.expect(pm.response.json().status).to.eql('QA_REVIEW'));"],description='Requires assigned assessor, submitted state, assessment report and all required evidence including signed certificate for PASS.')
req('WF-13','QA verifies individual pack','POST','/api/v1/qa/cohorts/{{cohortId}}/learner-packs/{{learnerId}}/submit',body={'action':'APPROVE'},auth='qaToken',folder=F,needs='qaToken,cohortId,learnerId',checks=["pm.test('Pack verified',()=>pm.expect(pm.response.json().status).to.eql('VERIFIED'));"])
req('WF-14','Refresh session','POST','/api/v1/auth/refresh',body={'refreshToken':'{{refreshToken}}','transport':'native'},folder=F,needs='refreshToken',checks=["pm.test('Rotated session',()=>pm.expect(pm.response.json().accessToken).to.be.a('string'));","const b=pm.response.json();if(b.accessToken){pm.environment.set('accessToken',b.accessToken);pm.environment.set('refreshToken',b.refreshToken);}"])
req('WF-15','Logout session','POST','/api/v1/auth/logout',auth='accessToken',folder=F,needs='accessToken',checks=["pm.test('Signed out',()=>pm.expect(pm.response.json().ok).to.eql(true));"])
req('WF-16','Logged-out token rejected','GET','/api/v1/me',401,auth='accessToken',folder=F,needs='accessToken',code='SESSION_EXPIRED')
collection={'info':{'name':'AgriProvider API - Developer test cases','schema':'https://schema.getpostman.com/json/collection/v2.1.0/collection.json','description':'Read docs/postman/developer-api-test-cases.md. Smoke folder is read-only. Other folders require disposable local fixtures and explicit opt-in. No real credentials are included.'},'item':[{'name':name,'item':v} for name,v in folders.items()]}
(POST/'AgriProvider.postman_collection.json').write_text(json.dumps(collection,indent=2)+'\n')
variables={'baseUrl':'http://localhost:4001','allowTestExecution':'false'}
for n in ['email','password','accessToken','refreshToken','providerToken','assessorToken','qaToken','adminToken','learnerToken','otherLearnerToken','cohortId','learnerId','milestoneId','evidenceId','uploadOpId']:variables[n]=''
environment={'name':'AgriProvider - Disposable local test','values':[{'key':k,'value':v,'enabled':True,'type':'secret' if 'Token' in k or k=='password' else 'default'} for k,v in variables.items()],'_postman_variable_scope':'environment'}
(POST/'AgriProvider.local.postman_environment.json').write_text(json.dumps(environment,indent=2)+'\n')
guide='''# Developer API test cases - Postman

Version 1.0 | 12 November 2026 (SAST)

## Import and execution

Import `AgriProvider.postman_collection.json` and `AgriProvider.local.postman_environment.json` into Postman. Select the environment. The collection has 30 requests with explicit HTTP/response assertions, not merely saved URLs. The API reference documents all 91 routes; this collection is a representative regression suite, not exhaustive endpoint coverage.

1. For read-only checks, set baseUrl to the running API and run **01 Read-only smoke** only. The working app currently uses port 4000. No credentials are required.
2. For all other folders, start an isolated API at `http://localhost:4001` backed by a disposable `_test` database. Apply the existing migrations and synthetic seed there using process-scoped DATABASE_URL/DIRECT_URL overrides; never edit the working API environment to run tests. Use MAIL_MODE=local and test-only storage. Do not reuse the live Frankfurt database. See ../testing.md for the supported isolated runners.
3. Set `allowTestExecution=true` only for that disposable API. The pre-request guard skips other host/port combinations using `pm.execution.skipRequest()`; use a Postman version supporting that API. Skipped cases are not passes. This URL guard does not prove database isolation: verify the server's database configuration first. See [Postman's execution reference](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution/).
4. Enter disposable provider credentials for AU-01. It stores accessToken/refreshToken. Obtain each other role's session using the login contract and set providerToken, assessorToken, qaToken, adminToken, learnerToken and otherLearnerToken locally. AU-01 does not fill role tokens automatically. Admin requires a current authenticator code. Keep secrets local and clear them before exporting.
5. Use IDs from the disposable cohort. The learner token must match learnerId; otherLearnerToken must be a different learner. Configure all evidence/assessment prerequisites listed below before each workflow phase. Choose the same genuine file for WF-08/WF-09.
6. Run cases in their documented phases. WF-01 through WF-10 use an editable or correction fixture; WF-11 through WF-13 require a prepared complete pack and assessor results. This is not a zero-configuration end-to-end seed runner. Refresh/logout cases operate on the AU-01 session.
7. Record actual status, assertion results, tester, SAST time and defect link. Reset only disposable fixtures. Exports may contain tokens or personal data: redact them before committing reports.

## Preconditions and expected results

Each request includes the exact expected status and response assertions. A failing prerequisite is a test setup failure, not proof of an API defect. Authentication must not silently pass on an MFA setup challenge. Keep a separate fixture for correction-after-unlock so it does not invalidate a later approval test.

| ID | Case | Expected HTTP | Error / assertion | Fixture notes |
|---|---|---|---|---|
'''
for c in cases:guide+=f'| {c[0]} | {c[1]} | {c[3]} | {c[4]} | {c[5] or "See folder setup and request assertions."} |\n'
guide+='''
## Additional manual regression scenarios

These are specified cases, not included executable requests. Record them as not run until executed with controlled fixtures.

| ID | Procedure | Expected result |
|---|---|---|
| EX-01 | Repeat WF-08 with a new operation ID, then list pack files | Both old/new files exist; latest evidence drives completeness |
| EX-02 | Reuse uploadOpId with different file bytes | 409 OP_CONFLICT; no replacement record |
| EX-03 | Upload certificate before PASS, then after PASS with signer | First fails INVALID_CERTIFICATE; second succeeds only with signature and editable scope |
| EX-04 | Upload synthetic certificate type in test versus production | Test permits type; production rejects unsupported content; malware checks remain enforced |
| EX-05 | Provider creates a learner account | New address receives setup message, creator receives confirmation; no password in either |
| EX-06 | Admin attempts provider cohort mutation | Role boundary rejects request; provider can create/close own cohort |
| EX-07 | Submit grades missing a learner, then all grades; moderate as same assessor | Incomplete grading rejected; full batch atomic; self-moderation returns 403 |
| EX-08 | QA unlock before conditions; then after conditions and findings resolved | Blocked first; then certification visible only to passing learners and authorized integration |
| EX-09 | Refresh using a previously rotated refresh token | 401 and token family revoked |
| EX-10 | Submit mismatched country/province/phone and a valid combination | Invalid combination rejected; valid values accepted |
| EX-11 | Retry attendance with same clientOpId/payload, then changed payload | Stable first result; 409 OP_CONFLICT on changed payload |
| EX-12 | Scan MFA QR, complete challenge, reuse challenge or recovery code | Session only after valid verification; replay rejected |

## Evidence and execution status

See [validation-results.md](validation-results.md) for newly executed checks. Historical API/browser results are in [../testing.md](../testing.md); they must not be reported as executions of this new collection. Postman GUI import/full authenticated workflow remains a separate acceptance step unless explicitly recorded as run.
'''
(POST/'developer-api-test-cases.md').write_text(guide,encoding='utf8')
print(f'Built PDF tracker, {len(routes)}-route reference and {len(cases)}-request Postman pack.')
