import {
    init,
    OpacityEnvironment,
    get as opacityGet,
} from '@opacity-labs/react-native-opacity'
import { useState } from 'react'
import { Button } from 'react-native'
import {ThemedText} from "@/components/ThemedText";

init({apiKey:process.env.EXPO_PUBLIC_OPACITY_API_KEY, dryRun: false, environment: OpacityEnvironment.Production, shouldShowErrorsInWebView: true})

// type OpacityVerificationMsg = {
//     message: string,
//     signature: string,
//     data:
// }

export function GithubProfile(): React.JSX.Element {

    const [result, setResult] = useState("")


    const getGithubProfile = async evt => {
        let result = await opacityGet('flow:github:profile')
        console.log("result json: ", result.json)
        console.log("result keys: ", Object.keys(result))
        console.log("result hash: ", result.hash)
        console.log("result signature: ", result.signature)
        console.log("result message: ", result.message)
        console.log("result payload: ", result.payload)

        // verify result before proceeding
        const verificationResult = await fetch('https://verifier.opacity.network/api/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: result.hash,
                signature: result.signature,
            }),
        })
        console.log("verification status: ", verificationResult.status)
        let data = await verificationResult.json()
        console.log("verification result: ", data)

        if (!data.valid) {
            throw new Error('Verification failed')
        }

        // pull specific data
        let following = result.json["following"]
        let followers = result.json["followers"]

        let famousOnGithub = following < followers

        // construct a msg to submit to chain verification

        setResult(JSON.stringify(famousOnGithub, null, 2))
    }

    return (
        <>
            <Button
                title="Famous on Github?"
                onPress={getGithubProfile}
            />
            <ThemedText>{result}</ThemedText>
        </>
    )
}
