

export function random(length:number){
    const options = "qwertyasdflhlkjlwoeiroeirseorwaoelsfk"
    const len = options.length
    let ans = ""

    for(let i = 0 ; i<len; i++){
        ans += options[Math.floor(Math.random()*len)]
    }

    return ans
}