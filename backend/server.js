import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const frontendDir=path.resolve(dir,'../frontend');
const db=new DatabaseSync(path.join(dir,'stockflow.db'));
db.exec(`CREATE TABLE IF NOT EXISTS organizations(id INTEGER PRIMARY KEY, name TEXT NOT NULL, default_threshold INTEGER NOT NULL DEFAULT 5);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, organization_id INTEGER NOT NULL REFERENCES organizations(id));
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, organization_id INTEGER NOT NULL REFERENCES organizations(id), name TEXT NOT NULL, sku TEXT NOT NULL, description TEXT, quantity INTEGER NOT NULL DEFAULT 0, cost REAL, price REAL, threshold INTEGER, UNIQUE(organization_id,sku));`);
const addColumn=(table,column,definition)=>{try{db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)}catch{}};
addColumn('organizations','default_threshold','INTEGER NOT NULL DEFAULT 5'); addColumn('products','description','TEXT'); addColumn('products','cost','REAL');
const app=express(); app.use(express.json());
app.use(session({secret:process.env.SESSION_SECRET||'stockflow-demo-change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',maxAge:86400000}}));
const auth=(req,res,next)=>req.session.userId?next():res.status(401).json({error:'Please log in.'});
app.post('/api/signup',async(req,res)=>{try{const {name,organization,email,password}=req.body;if(!name?.trim()||!organization?.trim()||!email?.trim()||!password||password.length<6)return res.status(400).json({error:'Fill all fields. Password must be at least 6 characters.'});const org=db.prepare('INSERT INTO organizations(name) VALUES (?)').run(organization.trim());const user=db.prepare('INSERT INTO users(name,email,password,organization_id) VALUES (?,?,?,?)').run(name.trim(),email.toLowerCase().trim(),await bcrypt.hash(password,10),org.lastInsertRowid);req.session.userId=user.lastInsertRowid;res.json({user:{name:name.trim(),organization:organization.trim()}})}catch(e){res.status(400).json({error:e.message.includes('UNIQUE')?'That email is already registered.':'Could not create account.'})}});
app.post('/api/login',async(req,res)=>{const {email,password}=req.body;const user=db.prepare('SELECT users.*,organizations.name AS organization FROM users JOIN organizations ON organizations.id=users.organization_id WHERE email=?').get((email||'').toLowerCase().trim());if(!user||!await bcrypt.compare(password||'',user.password))return res.status(401).json({error:'Email or password is incorrect.'});req.session.userId=user.id;res.json({user:{name:user.name,organization:user.organization}})});
app.get('/api/me',(req,res)=>{if(!req.session.userId)return res.status(401).json({error:'Not logged in'});const u=db.prepare('SELECT users.name,organizations.name AS organization FROM users JOIN organizations ON organizations.id=users.organization_id WHERE users.id=?').get(req.session.userId);u?res.json({user:u}):res.status(401).json({error:'Not logged in'})});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/products',auth,(req,res)=>{const user=db.prepare('SELECT organization_id FROM users WHERE id=?').get(req.session.userId);const org=db.prepare('SELECT default_threshold FROM organizations WHERE id=?').get(user.organization_id);res.json(db.prepare('SELECT id,name,sku,description,quantity,cost,price,COALESCE(threshold,?) AS threshold FROM products WHERE organization_id=? ORDER BY id DESC').all(org.default_threshold,user.organization_id))});
function saveProduct(req,res,id){try{const user=db.prepare('SELECT organization_id FROM users WHERE id=?').get(req.session.userId);const {name,sku,description,quantity,cost,price,threshold}=req.body;if(!name?.trim()||!sku?.trim()||!Number.isInteger(Number(quantity))||Number(quantity)<0)return res.status(400).json({error:'Name, SKU and a non-negative whole quantity are required.'});const num=v=>v===''||v==null?null:Number(v);if(id)db.prepare('UPDATE products SET name=?,sku=?,description=?,quantity=?,cost=?,price=?,threshold=? WHERE id=? AND organization_id=?').run(name.trim(),sku.trim(),description||'',Number(quantity),num(cost),num(price),num(threshold),id,user.organization_id);else db.prepare('INSERT INTO products(organization_id,name,sku,description,quantity,cost,price,threshold) VALUES (?,?,?,?,?,?,?,?)').run(user.organization_id,name.trim(),sku.trim(),description||'',Number(quantity),num(cost),num(price),num(threshold));res.json({ok:true})}catch(e){res.status(400).json({error:e.message.includes('UNIQUE')?'SKU already exists in this organization.':'Could not save product.'})}}
app.post('/api/products',auth,(req,res)=>saveProduct(req,res));
app.put('/api/products/:id',auth,(req,res)=>saveProduct(req,res,req.params.id));
app.get('/api/settings',auth,(req,res)=>{const u=db.prepare('SELECT organization_id FROM users WHERE id=?').get(req.session.userId);res.json(db.prepare('SELECT default_threshold FROM organizations WHERE id=?').get(u.organization_id))});
app.put('/api/settings',auth,(req,res)=>{const value=Number(req.body.default_threshold);if(!Number.isInteger(value)||value<0)return res.status(400).json({error:'Enter a whole number zero or greater.'});const u=db.prepare('SELECT organization_id FROM users WHERE id=?').get(req.session.userId);db.prepare('UPDATE organizations SET default_threshold=? WHERE id=?').run(value,u.organization_id);res.json({ok:true})});
app.delete('/api/products/:id',auth,(req,res)=>{const user=db.prepare('SELECT organization_id FROM users WHERE id=?').get(req.session.userId);db.prepare('DELETE FROM products WHERE id=? AND organization_id=?').run(req.params.id,user.organization_id);res.json({ok:true})});
if(process.env.NODE_ENV==='production'){app.use(express.static(path.join(frontendDir,'dist')));app.get('*',(req,res)=>res.sendFile(path.join(frontendDir,'dist','index.html')))}else{const vite=await createViteServer({root:frontendDir,server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares)}
const port = process.env.PORT || 3001;
app.listen(port,()=>console.log(`111project running at http://localhost:${port}`));
