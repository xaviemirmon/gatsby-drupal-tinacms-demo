import React from "react"
import { graphql, navigate, useStaticQuery } from "gatsby"
import { useCMS, useForm, usePlugin } from "tinacms"
import axios from "axios"
import qs from 'qs'
import { imageListBlock } from "../../../components/Images/ImageList"
import { paragraphBlock } from "../../../components/Text/Paragraph"
import { featureListBlock } from "../../../components/Features/FeatureList"
import { accordionListBlock } from "../../../components/Accordions/AccordionList"
import { InlineBlocks, InlineForm } from "react-tinacms-inline"
// import { InlineForm } from "../../../utils/TinaCMS/InlineForm"
import { heroBlock } from "../../../components/Heros/Hero"
import Seo from "../../../components/Misc/Seo"
import { isLoggedIn } from "../../../services/Auth"
import {
  processDrupalFeaturesData,
  processDrupalImageData,
  processDrupalParagraphData,
} from "../../../utils/GetRequestUtils"
import { formatDrupalType } from "../../../utils/Utils"
import Header from "../../../components/Headers/Header"
import Footer from "../../../components/Footers/Footer"
import { Title } from "../../../components/Text/Title"


const EditPage = ({serverData}) => {

  const data = useStaticQuery(graphql`
    query TinaSiteTitleQuery {
      site {
        siteMetadata {
          title
        }
      }
    }
  `)

  let drupalData = {}
  let blocks = []

  if (serverData.hasOwnProperty('content')) {
    if (!serverData.content.data[0].field_page_builder.data) {
      serverData.content.data[0].field_page_builder.forEach((value, index) => {
        let type = formatDrupalType(value.type)

        switch (type) {
          case "images":
            blocks[index] = processDrupalImageData(type, value)
            break

          case "features":
            blocks[index] = processDrupalFeaturesData(type, value)
            break

          default:
            blocks[index] = processDrupalParagraphData(type, value)
        }
      })
    }

    drupalData.title = serverData.content.data[0].title
    drupalData.nid = serverData.content.data[0].drupal_internal__nid
    drupalData.uid = serverData.content.data[0].uid
  }

  drupalData.blocks = blocks


  const cms = useCMS()

  const formConfig = {
    initialValues: drupalData,
    onSubmit(data) {
      axios.post(process.env.GATSBY_DRUPAL_HOST + `/api/tinacms/page/create`, qs.stringify({
        json_data: data
      })).then((response) => {
        console.log(response)
        cms.alerts.success("Saved!")
      }, (error) => {
        console.log(error)
        cms.alerts.error("Error saving")
      })
    },
  }

  const [, form] = useForm(formConfig)

  usePlugin(form)

  if (serverData.hasOwnProperty('goto')) {
    navigate("/admin/login", {
      state: {message: "your session has been timed out, please login", goto: serverData.goto},
    })
    return null
  }

  return (
    <>
      <Seo title="Edit page"/>
      <Header siteTitle={data.site.siteMetadata?.title || `Title`}/>
      <div className="home">
        <InlineForm form={form}>
          <Title title={serverData.content.data[0].title}/>
          <InlineBlocks name="blocks" blocks={availableBlocks}/>
        </InlineForm>
      </div>
      <Footer/>
    </>
  )
}


const availableBlocks = {
  hero: heroBlock,
  paragraph: paragraphBlock,
  images: imageListBlock,
  features: featureListBlock,
  accordions: accordionListBlock
}

export default EditPage

export async function getServerData({params, headers}) {
  const token = await isLoggedIn(Object.fromEntries(headers).cookie)

  const requestHeaders = {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  }

  const includes = [
    'field_page_builder',
    'field_page_builder.field_image.field_media.field_media_image',
    'field_page_builder.field_image.field_media.thumbnail',
    'field_page_builder.field_feature'
  ]

  const currentRoute =
    `jsonapi/node?filter[drupal_internal__nid]=` +
    params["*"] +
    '&include=' +
    includes.toString() +
    `&jsonapi_include=1`

  try {
    const [adminMenu, content] = await Promise.all([
      fetch(
        process.env.GATSBY_DRUPAL_HOST + `/jsonapi/menu_items/admin`,
        requestHeaders
      ),
      fetch(
        process.env.GATSBY_DRUPAL_HOST + `/` + currentRoute,
        requestHeaders
      ),
    ])
    if (
      adminMenu.status === 401 ||
      content.status === 401
    ) {
      return {
        props: {
          goto: 'page/edit/' + params["*"]
        },
      }
    }
    if (
      !adminMenu.ok || !content.ok
    ) {
      throw new Error(`Response failed`)
    }

    // if (!adminMenu.ok) {
    //     throw new Error(`Response failed`, content.status);
    // }
    return {
      props: {
        adminMenu: await adminMenu.json(),
        content: await content.json(),
      },
    }
  } catch (error) {
    console.log(error)
    return {
      status: 500,
      headers: {},
      props: {},
    }
  }
}