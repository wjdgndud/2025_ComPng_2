// vote_form.js
import { createPoll } from "./pollData.js";

const MAX_OPTIONS = 10;

// ====== 기존 폼 엘리먼트 가져오기 ======
const form = document.getElementById("create-poll-form");
const questionInput = document.getElementById("poll-question");
const oldInput = document.getElementById("poll-options");

// ====== 기존 input 숨기기 및 새 컨테이너 추가 ======
oldInput.style.display = "none";

const optionsContainer = document.createElement("div");
optionsContainer.id = "dynamic-options-container";
oldInput.parentNode.insertBefore(optionsContainer, oldInput.nextSibling);

const addButton = document.createElement("button");
addButton.type = "button";
addButton.textContent = "항목 추가";
form.insertBefore(addButton, form.querySelector('button[type="submit"]'));

// ====== 옵션 입력 관리 ======
let optionCount = 0;

function createOptionInput(value = "") {
    if (optionCount >= MAX_OPTIONS) {
        alert(`항목은 최대 ${MAX_OPTIONS}개까지만 추가할 수 있습니다.`);
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("option-input");

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `항목 ${optionCount + 1}`;
    input.maxLength = 20;
    input.value = value;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
        wrapper.remove();
        optionCount--;
        updatePlaceholders();
    });

    wrapper.appendChild(input);
    wrapper.appendChild(delBtn);
    optionsContainer.appendChild(wrapper);
    optionCount++;
}

function updatePlaceholders() {
    const inputs = optionsContainer.querySelectorAll("input");
    inputs.forEach((input, i) => {
        input.placeholder = `항목 ${i + 1}`;
    });
}

// ====== 초기 2개 생성 ======
createOptionInput();
createOptionInput();

addButton.addEventListener("click", () => createOptionInput());

// ====== 기존 form 이벤트 가로채기 ======
const oldHandler = form.onsubmit; // 기존 이벤트 핸들러 백업 (index.html의 script 내부)
form.onsubmit = async (e) => {
    e.preventDefault();

    const question = questionInput.value.trim();
    const options = Array.from(optionsContainer.querySelectorAll("input"))
        .map((i) => i.value.trim())
        .filter((v) => v.length > 0);

    if (!question) {
        alert("질문을 입력해주세요.");
        return;
    }

    if (options.length < 2) {
        alert("최소 2개 이상의 항목을 입력해주세요.");
        return;
    }

    if (options.length > MAX_OPTIONS) {
        alert(`항목은 최대 ${MAX_OPTIONS}개까지만 추가할 수 있습니다.`);
        return;
    }

    if (options.some((opt) => opt.length > 20)) {
        alert("항목은 20자 이하로 입력해주세요.");
        return;
    }

    try {
        await createPoll(question, options);
        alert("새 투표가 생성되었습니다.");
        questionInput.value = "";
        optionsContainer.innerHTML = "";
        optionCount = 0;
        createOptionInput();
        createOptionInput();
    } catch (err) {
        console.error("투표 생성 오류:", err);
        alert("투표 생성에 실패했습니다.");
    }

    // 기존 submit 로직(있을 경우)도 실행
    if (typeof oldHandler === "function") oldHandler(e);
};
