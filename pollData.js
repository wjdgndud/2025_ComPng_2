// pollData.js
import { db, auth } from "./firebaseConfig.js";

import {
    collection, doc, getDoc, setDoc, deleteDoc, updateDoc,
    onSnapshot, addDoc, runTransaction, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { load } from "https://esm.sh/@fingerprintjs/fingerprintjs@4";

let userUid = null;
let visitorId = null;

// Fingerprint 생성 및 Firebase 익명 인증 처리
export async function initAuth() {
    return new Promise(async (resolve, reject) => {
        try {
            // Fingerprint 생성
            const fp = await load();
            const result = await fp.get();
            visitorId = result.visitorId;

            // Firebase 익명 인증 처리
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    unsubscribe();
                    userUid = user.uid;
                    resolve(user);
                } else {
                    try { await signInAnonymously(auth); } 
                    catch (error) { reject(error); }
                }
            });
        } catch (error) {
            return reject(error);
        }
    });
}

// 실시간 투표 로드
export async function loadPoll() {
    const pollsDiv = document.getElementById("polls");
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        pollsDiv.innerHTML = ""; 

        if (snapshot.empty) {
            pollsDiv.innerText = "등록된 투표가 없습니다.";
            return;
        }

        // 정렬 보장
        let docs = [];
        snapshot.docs.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        docs.forEach((data) => {
            const pollId = data.id;
            const tags = data.tags || [];
            const tagsDisplay = tags.map(t => `#${t}`).join(" ");
            const tagsAttr = tags.join(",");

            const pollContainer = document.createElement("div");
            pollContainer.className = "poll-container";
            pollContainer.setAttribute("data-tags", tagsAttr);

            const headerDiv = document.createElement("div");
            headerDiv.className = "poll-header";

            const contentDiv = document.createElement("div");
            contentDiv.className = "poll-header-content";

            const questionEl = document.createElement("h3");
            questionEl.className = "poll-question";
            questionEl.textContent = data.question;

            const tagsEl = document.createElement("small");
            tagsEl.className = "poll-tags";
            tagsEl.textContent = tagsDisplay; 


            contentDiv.appendChild(questionEl);
            contentDiv.appendChild(tagsEl);
            headerDiv.appendChild(contentDiv);

            const resultBtn = document.createElement("button");
            resultBtn.className = "result-btn";
            resultBtn.textContent = "결과 보기";

            resultBtn.onclick = () => {
                import("./chartView.js").then(module => {
                    module.showVoteChart(pollId);
                });
            };

            headerDiv.appendChild(resultBtn);



            if (userUid && data.ownerId === userUid) {
                const btnDiv = document.createElement("div");
                btnDiv.className = "poll-manage-btns";
                
                btnDiv.innerHTML = `
                    <button class="edit-btn">수정</button>
                    <button class="delete-btn">삭제</button>
                `;
                
                btnDiv.querySelector(".edit-btn").onclick = () => window.editPoll(pollId);
                btnDiv.querySelector(".delete-btn").onclick = () => window.deletePoll(pollId);
                
                headerDiv.appendChild(btnDiv);
            }
            pollContainer.appendChild(headerDiv);

            const optionContainer = document.createElement("div");
            optionContainer.className = "poll-options";

            data.options.forEach((opt, index) => {
                const btn = document.createElement("button");
                const voteCount = data.votes && data.votes[index] ? data.votes[index] : 0;
                btn.textContent = `${opt} (${voteCount}표)`;
                btn.className = "poll-options button";
                btn.onclick = async () => {
                    await vote(pollId, index);
                    
                    document.dispatchEvent(new CustomEvent("pollVoted", {detail: pollId}));
                };

                optionContainer.appendChild(btn);
            });

            pollContainer.appendChild(optionContainer);
            pollsDiv.appendChild(pollContainer);
        }); 
    });
}

// 투표 처리
async function vote(pollId, optionIndex) {
    if (!userUid || !visitorId) return alert("로딩 중입니다.");
    
    const pollRef = doc(db, "polls", pollId);
    const voteRef = doc(db, "polls", pollId, "votes", userUid);
    const fpRef = doc(db, "polls", pollId, "fingerprints", visitorId);

    try {
        await runTransaction(db, async (transaction) => {
            const pollSnap = await transaction.get(pollRef);
            const voteSnap = await transaction.get(voteRef);
            const fpSnap = await transaction.get(fpRef);

            if (!pollSnap.exists()) throw "투표가 없습니다.";
            if (voteSnap.exists()) throw "이미 투표했습니다.";
            if (fpSnap.exists()) throw "이 기기에서 이미 투표했습니다.";

            const pollData = pollSnap.data();
            const newVotes = [...pollData.votes];
            newVotes[optionIndex]++;

            transaction.update(pollRef, { votes: newVotes });
            transaction.set(voteRef, { option: optionIndex, timestamp: new Date() });
            transaction.set(fpRef, { votedBy: userUid, timestamp: new Date() });
        });
        alert("투표 완료!");
    } catch (err) {
        console.error(err);
        alert(typeof err === "string" ? err : "투표 실패");
    }
}

// 투표 생성
export async function createPoll(question, options, tags) {
    await addDoc(collection(db, "polls"), {
        question, options, tags,
        votes: new Array(options.length).fill(0),
        createdAt: serverTimestamp(),
        ownerId: userUid
    });
}

// 투표 삭제
window.deletePoll = async (pollId) => {
    if (!confirm("정말로 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(db, "polls", pollId));
        alert("삭제되었습니다.");
    } catch (e) {
        console.error(e);
        alert("삭제 권한이 없습니다.");
    }
};

// 투표 수정
window.editPoll = async (pollId) => {
    try {
        // (1) 최신 데이터 가져오기
        const pollRef = doc(db, "polls", pollId);
        const snap = await getDoc(pollRef);
        if (!snap.exists()) return alert("투표가 존재하지 않습니다.");
        
        const data = snap.data();

        // (2) 질문 수정
        const newQ = prompt("수정할 질문을 입력하세요 (50자 이내):", data.question);
        if (newQ === null) return;
        const cleanQ = newQ.trim();
        if (!cleanQ || cleanQ.length > 50) return alert("질문은 1자 이상 50자 이하로 입력해야 합니다.");

        // (3) 옵션 수정
        const oldOptionsStr = data.options.join(",");
        const newOptionsStr = prompt("수정할 옵션을 콤마로 구분해 입력하세요 (2~10개, 각 20자 이내):", oldOptionsStr);
        if (newOptionsStr === null) return;

        let cleanOptions = newOptionsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);
        
        // 옵션 중복 체크
        if (new Set(cleanOptions).size !== cleanOptions.length) return alert("중복된 옵션이 있습니다.");
        if (cleanOptions.length < 2 || cleanOptions.length > 10) return alert("옵션은 2개~10개 사이여야 합니다.");
        if (cleanOptions.some(opt => opt.length > 20)) return alert("각 옵션은 20자 이내여야 합니다.");

        // (4) 태그 수정
        const oldTagsStr = (data.tags || []).join(",");
        const newTagsStr = prompt("수정할 태그를 입력하세요 (최대 5개, 각 10자 이내):", oldTagsStr);
        if (newTagsStr === null) return;

        let cleanTags = newTagsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);
        cleanTags = [...new Set(cleanTags)]; // 태그 중복 제거

        if (cleanTags.length > 5) return alert("태그는 최대 5개입니다.");
        if (cleanTags.some(t => t.length > 10)) return alert("태그는 10자 이내여야 합니다.");
        if (cleanTags.some(tag => /[^a-zA-Z0-9가-힣\s]/.test(tag))) return alert("태그에는 특수문자를 사용할 수 없습니다.");

        // (5) 변경 사항 확인
        const isQuestionSame = cleanQ === data.question; // 질문 변경 여부
        const isOptionsSame = JSON.stringify(cleanOptions) === JSON.stringify(data.options); // 옵션 변경 여부
        const isTagsSame = JSON.stringify(cleanTags) === JSON.stringify(data.tags); // 태그 변경 여부

        if (isQuestionSame && isOptionsSame && isTagsSame) {
            return alert("변경된 내용이 없습니다.");
        }

        // (6) 투표 수 초기화 결정
        // 질문이 바뀌거나(의미 변질 우려), 옵션이 바뀌면(매칭 불가) -> 무조건 초기화
        let finalVotes = data.votes;
        const needsReset = !isQuestionSame || !isOptionsSame; // 둘 중 하나라도 바뀌면 true

        if (needsReset) {
            const warningMsg = !isQuestionSame 
                ? "⚠️ 질문 내용이 변경되어 투표의 의미가 달라질 수 있습니다." 
                : "⚠️ 옵션 내용이 변경되었습니다.";
            
            const confirmReset = confirm(
                `${warningMsg}\n공정성을 위해 기존 투표 기록이 0으로 초기화됩니다.\n\n정말 수정하시겠습니까?`
            );
            
            if (!confirmReset) return; // 취소
            
            // 투표수 0으로 리셋
            finalVotes = new Array(cleanOptions.length).fill(0);
        } else {
            // 태그만 바뀐 경우 -> 투표 수 유지 (태그는 의미를 뒤집지 않으므로)
        }

        // (7) DB 업데이트
        await updateDoc(pollRef, {
            question: cleanQ,
            options: cleanOptions,
            tags: cleanTags,
            votes: finalVotes
        });
        
        alert("성공적으로 수정되었습니다.");

    } catch (e) {
        console.error(e);
        alert("수정 권한이 없거나 오류가 발생했습니다.");
    }
};

// 실시간 그래프 데이터 로드
export function listenForGraphData(callback) {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const pollsData = [];
        snapshot.docs.forEach(doc => pollsData.push({ id: doc.id, ...doc.data() }));
        callback(pollsData);
    });
}
