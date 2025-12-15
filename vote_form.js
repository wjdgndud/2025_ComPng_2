// vote_form.js
import { createPoll } from "./pollData.js";

const MAX_OPTIONS = 10;
const MAX_TAGS = 5;

const form = document.getElementById("create-poll-form");
const questionInput = document.getElementById("poll-question");
const tagsInput = document.getElementById("poll-tags");
const tagsContainer = document.getElementById("recommended-tags-container");

// ====== 새 컨테이너 추가 (옵션 입력용) ======
const optionsContainer = document.createElement("div");
optionsContainer.id = "dynamic-options-container";
questionInput.parentNode.insertBefore(optionsContainer, questionInput.nextElementSibling);

const addButton = document.createElement("button");
addButton.type = "button";
addButton.textContent = "옵션 추가";

// [변경] 디자인을 위해 클래스 추가 (기존에는 없었음)
addButton.className = "add-option-btn";

form.insertBefore(addButton, form.querySelector('button[type="submit"]'));

// ====== 옵션 입력 관리 ======
let optionCount = 0;

// ▼▼▼ [수정] 추천 태그 목록 확장 (18개) ▼▼▼
const RECOMMENDED_TAGS = [
    "IT", "게임", "음식", "여행", "스포츠", 
    "음악", "영화", "책", "패션", "학교", 
    "연애", "고민", "정치", "경제", "진로", 
    "반려동물", "건강", "취미"
];

function createOptionInput(value = "") {
    if (optionCount >= MAX_OPTIONS) {
        alert(`옵션은 최대 ${MAX_OPTIONS}개까지만 추가할 수 있습니다.`);
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("option-input");

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `옵션 ${optionCount + 1}`;
    input.maxLength = 20;
    input.value = value;
    
    wrapper.appendChild(input);

    if (optionCount > 1) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "삭제";

        // [변경] 삭제 버튼 스타일링을 위한 클래스 추가
        delBtn.className = "delete-option-btn";

        delBtn.addEventListener("click", () => {
            wrapper.remove();
            optionCount--;
            updatePlaceholders();
        });
        wrapper.appendChild(delBtn);
    }
    
    optionsContainer.appendChild(wrapper);
    optionCount++;
}

function updatePlaceholders() {
    const inputs = optionsContainer.querySelectorAll("input");
    inputs.forEach((input, i) => {
        input.placeholder = `옵션 ${i + 1}`;
    });
}

// 초기 옵션 2개 생성
createOptionInput();
createOptionInput();

addButton.addEventListener("click", () => createOptionInput());

// ====== 추천 태그 버튼 생성 ======
RECOMMENDED_TAGS.forEach(tag => {
    const tagBtn = document.createElement("button");
    tagBtn.type = "button";
    tagBtn.textContent = `#${tag}`;
    
    // [변경점] 기존 JS에 있던 style.cssText 및 마우스 이벤트 제거
    // 대신 CSS 클래스 'recommend-tag-btn'을 추가하여 스타일 파일에서 제어
    tagBtn.className = "recommend-tag-btn";

    tagBtn.onclick = () => {
        const currentVal = tagsInput.value.trim();
        if (currentVal.length > 0) {
            if(!currentVal.includes(tag)) {
                tagsInput.value = currentVal + ", " + tag;
            }
        } else {
            tagsInput.value = tag;
        }
    };
    tagsContainer.appendChild(tagBtn);
});

// ====== 폼 제출 이벤트 ======
form.onsubmit = async (e) => {
    e.preventDefault();

    const question = questionInput.value.trim();
    const options = Array.from(optionsContainer.querySelectorAll("input"))
        .map((i) => i.value.trim())
        .filter((v) => v.length > 0);

    if (!question || question.length > 50) {
        alert("질문은 50자 이하로 입력해주세요.");
        return;
    }
    if (options.length < 2 || options.length > MAX_OPTIONS) {
        alert(`옵션은 2개 이상 ${MAX_OPTIONS}개 이하로 입력해주세요.`);
        return;
    }
    if (options.some((opt) => opt.length > 20)) {
        alert("옵션은 20자 이하로 입력해주세요.");
        return;
    }

    const tagsStr = tagsInput.value.trim();
    if (!tagsStr) {
        alert("태그를 입력하거나 추천 태그를 선택해주세요.");
        return;
    }
    const tags = tagsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);

    if (tags.length > MAX_TAGS) {
        alert(`태그는 최대 ${MAX_TAGS}개까지만 입력할 수 있습니다. 핵심적인 태그만 입력해주세요.`);
        return;
    }

    for (const tag of tags) {
        if (tag.length > 10) {
            alert("태그는 10자 이하로 입력해주세요.");
            return;
        }

        if (/[^a-zA-Z0-9가-힣\s]/.test(tag)) {
            alert(`태그 '${tag}'에는 특수문자를 사용할 수 없습니다. (한글, 영문, 숫자만 가능)`);
            return;
        }
    }

    try {
        await createPoll(question, options, tags);
        alert("새 투표가 생성되었습니다.");
        
        // 초기화
        questionInput.value = "";
        optionsContainer.innerHTML = "";
        optionCount = 0;
        createOptionInput();
        createOptionInput();
        tagsInput.value = "";
    } catch (err) {
        console.error("투표 생성 오류:", err);
        alert("투표 생성에 실패했습니다.");
    }
};
