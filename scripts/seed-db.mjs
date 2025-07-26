
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, setDoc, doc, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { getDatabase, ref, set } from 'firebase/database';

// IMPORTANT: Load environment variables from .env file
import { config } from 'dotenv';
config({ path: './.env' });


const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// =============================================================================
// Helper Functions
// =============================================================================

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const getPatientInitials = (name) => {
    if(!name) return "";
    const names = name.split(" ")
    return names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : names[0]?.[0] || ""
}

// =============================================================================
// Seed Data
// =============================================================================

const users = [
    { email: 'abdlelah2013@gmail.com', password: '123456', name: 'عبدالإله القدسي', role: 'admin' },
    { email: 'receptionist@sahatech.com', password: '123456', name: 'فاطمة الزهراء', role: 'receptionist' },
    { email: 'doctor@sahatech.com', password: '123456', name: 'أحمد ياسين', role: 'doctor' },
];

const doctors = [
    {
        name: "علي الأحمد",
        specialty: "أمراض القلب",
        image: `https://placehold.co/100x100.png?text=A`,
        data_ai_hint: "doctor portrait",
        nextAvailable: 'غداً، 10:00 ص',
        isAvailableToday: true,
        servicePrice: 7000,
        freeReturnDays: 10,
        availableDays: ['الأحد', 'الثلاثاء', 'الخميس'],
        availability: [
            { date: '2024-07-28', slots: ['10:00', '10:30', '11:00', '14:00', '14:30'] },
            { date: '2024-07-30', slots: ['10:00', '10:30', '11:00', '14:00', '14:30'] }
        ]
    },
    {
        name: "سارة محمود",
        specialty: "الأمراض الجلدية",
        image: `https://placehold.co/100x100.png?text=S`,
        data_ai_hint: "doctor portrait",
        nextAvailable: 'اليوم، 4:00 م',
        isAvailableToday: true,
        servicePrice: 5000,
        freeReturnDays: 14,
        availableDays: ['السبت', 'الاثنين', 'الأربعاء'],
        availability: [
            { date: '2024-07-27', slots: ['16:00', '16:30', '17:00'] },
            { date: '2024-07-29', slots: ['16:00', '16:30', '17:00'] }
        ]
    },
    {
        name: "خالد عبد الله",
        specialty: "طب الأطفال",
        image: `https://placehold.co/100x100.png?text=K`,
        data_ai_hint: "doctor portrait",
        nextAvailable: 'بعد 3 أيام',
        isAvailableToday: false,
        servicePrice: 4000,
        freeReturnDays: 7,
        availableDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        availability: [
           { date: '2024-07-31', slots: ['09:00', '09:30', '10:00', '11:00'] }
        ]
    },
];

const patients = [
    { name: "محمد قائد", dob: "1985-05-20", gender: "ذكر", phone: "777123456", address: "صنعاء، شارع حده" },
    { name: "نورة صالح", dob: "1992-11-10", gender: "أنثى", phone: "777234567", address: "صنعاء، شارع الزبيري" },
    { name: "أحمد عبدالكريم", dob: "2018-01-15", gender: "ذكر", phone: "777345678", address: "صنعاء، شارع تعز" },
    { name: "فاطمة علي", dob: "1970-03-30", gender: "أنثى", phone: "777456789", address: "صنعاء، الدائري" },
];

async function seed() {
    console.log("Starting database seeding...");

    // 1. Seed Authentication and Users Collection
    console.log("Seeding users...");
    const userIds = {};
    for (const user of users) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
            const uid = userCredential.user.uid;
            userIds[user.role] = uid;
            
            // Add user to Firestore 'users' collection
            await setDoc(doc(db, 'users', uid), {
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: serverTimestamp()
            });
             console.log(`Successfully created user: ${user.email}`);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                console.log(`User ${user.email} already exists. Signing in to get UID.`);
                const userCredential = await signInWithEmailAndPassword(auth, user.email, user.password);
                const uid = userCredential.user.uid;
                userIds[user.role] = uid;
                await setDoc(doc(db, 'users', uid), { name: user.name, email: user.email, role: user.role }, { merge: true });
            } else {
                console.error(`Error creating user ${user.email}:`, error);
            }
        }
    }
    
    // Add contacts to users
     const adminId = userIds['admin'];
     const receptionistId = userIds['receptionist'];
     const doctorId = userIds['doctor'];

     if(adminId && receptionistId && doctorId) {
        await setDoc(doc(db, 'users', adminId), { contacts: { [receptionistId]: true, [doctorId]: true } }, { merge: true });
        await setDoc(doc(db, 'users', receptionistId), { contacts: { [adminId]: true, [doctorId]: true } }, { merge: true });
        await setDoc(doc(db, 'users', doctorId), { contacts: { [adminId]: true, [receptionistId]: true } }, { merge: true });
        console.log("Contacts seeded.");
     }


    const batch = writeBatch(db);

    // 2. Seed Doctors
    console.log("Seeding doctors...");
    const doctorRefs = {};
    for (const doctor of doctors) {
        const docRef = doc(collection(db, "doctors"));
        doctorRefs[doctor.name] = { id: docRef.id, ...doctor };
        batch.set(docRef, doctor);
    }

    // 3. Seed Patients
    console.log("Seeding patients...");
    const patientRefs = {};
    for (const patient of patients) {
        const docRef = doc(collection(db, "patients"));
        const avatarUrl = `https://placehold.co/40x40.png?text=${getPatientInitials(patient.name)}`;
        patientRefs[patient.name] = { id: docRef.id, ...patient, avatarUrl };
        batch.set(docRef, { ...patient, avatarUrl, createdAt: serverTimestamp() });
    }
    
    // Commit batch for doctors and patients
    await batch.commit();
    console.log("Doctors and Patients committed.");
    
    const newBatch = writeBatch(db);

    // 4. Seed Appointments and Transactions
    console.log("Seeding appointments and transactions...");
    const appointmentStatuses = ['Scheduled', 'Waiting', 'Completed', 'Follow-up'];
    const doctorValues = Object.values(doctorRefs);
    const patientValues = Object.values(patientRefs);

    for (let i = 0; i < 15; i++) {
        const patient = getRandomElement(patientValues);
        const doctor = getRandomElement(doctorValues);
        const status = getRandomElement(appointmentStatuses);
        const appointmentDate = getRandomDate(new Date(2024, 5, 1), new Date());
        
        const appointmentRef = doc(collection(db, "appointments"));
        newBatch.set(appointmentRef, {
            patientId: patient.id,
            patientName: patient.name,
            doctorId: doctor.id,
            doctorName: `د. ${doctor.name}`,
            doctorSpecialty: doctor.specialty,
            dateTime: appointmentDate.toISOString(),
            status: status
        });

        // Create a transaction for completed appointments
        if (status === 'Completed' && doctor.servicePrice) {
            const transactionRef = doc(collection(db, "transactions"));
            newBatch.set(transactionRef, {
                patientId: patient.id,
                patientName: patient.name,
                date: Timestamp.fromDate(appointmentDate),
                amount: doctor.servicePrice,
                status: 'Success',
                service: `${doctor.specialty} Consultation`
            });
        }
    }
    
     // 5. Seed Inbox Messages
    console.log("Seeding inbox messages...");
    if (adminId && receptionistId) {
        const inboxRef1 = doc(collection(db, "inboxMessages"));
        newBatch.set(inboxRef1, {
            from: "النظام",
            fromId: "system",
            title: "مرحباً بك في صحة تك!",
            content: "مرحباً بك في نظام صحة تك. لوحة التحكم هذه مصممة لمساعدتك في إدارة عيادتك بكفاءة. تفقد الأقسام المختلفة للبدء.",
            timestamp: serverTimestamp(),
            read: false,
            recipientId: adminId // Send to admin
        });
        
        const inboxRef2 = doc(collection(db, "inboxMessages"));
        newBatch.set(inboxRef2, {
            from: "د. علي الأحمد",
            fromId: doctorId,
            title: "استفسار بخصوص المريض محمد قائد",
            content: "يرجى مراجعة نتائج التحاليل الأخيرة للمريض محمد قائد وتحديد موعد للمتابعة في أقرب وقت ممكن.",
            timestamp: serverTimestamp(),
            read: true,
            recipientId: receptionistId // Send to receptionist
        });
    }


    await newBatch.commit();
    console.log("Appointments, Transactions, and Inbox Messages committed.");

    console.log("Database seeding completed successfully!");
    process.exit(0);
}

seed().catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
});
