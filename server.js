import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app=express();
app.use(cors());
app.use(express.json());

const users=[]; // Demo only. Replace with PostgreSQL/Supabase/Firebase in production.
const chats=[];
const settings={premiumPrice:199,freeDailyLimit:10};

function tokenFor(user){return jwt.sign({id:user.id,email:user.email},process.env.JWT_SECRET||"dev-only-secret",{expiresIn:"7d"});}
function auth(req,res,next){
  try{const h=req.headers.authorization||""; const t=h.startsWith("Bearer ")?h.slice(7):null;
    if(!t) return res.status(401).json({error:"Login required"});
    req.user=jwt.verify(t,process.env.JWT_SECRET||"dev-only-secret"); next();
  }catch{return res.status(401).json({error:"Invalid or expired token"});}
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"Bolo AI Backend",owner:"Sabroj Babu"}));

app.post("/api/auth/signup",async(req,res)=>{
  const {email,password}=req.body||{};
  if(!email||!password||password.length<6)return res.status(400).json({error:"Valid email and 6+ character password required"});
  if(users.some(u=>u.email===email.toLowerCase()))return res.status(409).json({error:"Account already exists"});
  const user={id:crypto.randomUUID(),email:email.toLowerCase(),password:await bcrypt.hash(password,12),plan:"free"};
  users.push(user);
  res.json({token:tokenFor(user),user:{id:user.id,email:user.email,plan:user.plan}});
});

app.post("/api/auth/login",async(req,res)=>{
  const {email,password}=req.body||{}; const user=users.find(u=>u.email===String(email||"").toLowerCase());
  if(!user||!(await bcrypt.compare(password||"",user.password)))return res.status(401).json({error:"Wrong email or password"});
  res.json({token:tokenFor(user),user:{id:user.id,email:user.email,plan:user.plan}});
});

app.get("/api/me",auth,(req,res)=>{
  const u=users.find(x=>x.id===req.user.id); if(!u)return res.status(404).json({error:"User not found"});
  res.json({id:u.id,email:u.email,plan:u.plan});
});

app.get("/api/settings",(req,res)=>res.json(settings));

app.post("/api/chat",async(req,res)=>{
  const message=String(req.body?.message||"").trim();
  if(!message)return res.status(400).json({error:"Message required"});
  // IMPORTANT: Do not expose AI_API_KEY in browser. Put provider call here on the server.
  if(!process.env.AI_API_KEY){
    return res.json({reply:"Bolo AI backend connected है। अब AI provider की server-side API key जोड़ने पर real AI जवाब चालू हो जाएगा।"});
  }
  // Provider-specific request intentionally left configurable because different AI providers use different APIs.
  res.json({reply:"AI provider endpoint configured है, लेकिन provider-specific request adapter अभी configure करना बाकी है।"});
});

app.post("/api/payment/create-order",auth,(req,res)=>{
  if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)
    return res.status(503).json({error:"Payment gateway is not connected yet"});
  res.status(501).json({error:"Connect the official Razorpay server SDK and create an order here; never trust a client-side payment success message."});
});

app.post("/api/payment/webhook",(req,res)=>{
  // Verify Razorpay/Cashfree webhook signature here before changing any user's plan.
  res.status(501).json({error:"Webhook verification must be implemented before production use"});
});

app.get("/api/admin/stats",(req,res)=>res.json({users:users.length,premium:users.filter(u=>u.plan==="premium").length,revenue:0}));

app.listen(process.env.PORT||3000,()=>console.log(`Bolo AI backend running on port ${process.env.PORT||3000}`));
